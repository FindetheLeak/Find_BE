const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const pool = require('./database');

/* 2025-09-24 00:38 변경사항 
1. user로직 그대로       actors(USER, user_id)    -> account_identities 연결
2. org(기업) ->          actors(org, org_id)      -> account_identities 연결
3. admin(관리자)검증후   actors(ADMIN)            -> account_identities 연결

----------------------------------------------------------------------------
4. 깃허브 회원가입 할 때 , 로그인 한 사용자가 이메일 비공개일 경우 나타나는 
 Email not provided by OAuth provider 에러 해결
 DB에 ${uname}@users.noreply.github.com 이메일로 일단 삽입
  

*/


async function fetchGithubPrimaryEmail(accessToken) {
  const resp = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Find_BE'
    }
  });
  if (!resp.ok) return null;
  const emails = await resp.json(); // [{email, primary, verified}, ...]
  if (!Array.isArray(emails) || emails.length === 0) return null;

  // 1순위: primary && verified
  const pv = emails.find(e => e.primary && e.verified);
  if (pv) return { email: pv.email, verified: true };

  // 2순위: verified
  const v = emails.find(e => e.verified);
  if (v) return { email: v.email, verified: true };

  // 3순위: 아무거나
  return { email: emails[0].email, verified: !!emails[0].verified };
}


function isAdminAllowed(email) {
  const allow = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes((email || '').toLowerCase());
}


async function findOrCreatePrincipal(req, accessToken, refreshToken, profile, done) {
  const provider = profile.provider.toUpperCase();
  const providerUserId = profile.id;
  let email = profile.emails && profile.emails[0] && profile.emails[0].value;
  const displayName = profile.displayName || profile.username;
  const profileImage = profile.photos && profile.photos[0].value;


  let emailVerified = true;
  if (!email && provider === 'GITHUB') {
    try {
      const fetched = await fetchGithubPrimaryEmail(accessToken);
      if (fetched && fetched.email) {
        email = fetched.email;
        emailVerified = !!fetched.verified;
      }
    } catch (_) { /* ignore and fallback below */ }
  }
  // 그래도 없으면 안전한 대체 이메일(UNIQUE 보장용) 사용
  if (!email) {
    const uname = profile.username || `gh_${providerUserId}`;
    email = `${uname}@users.noreply.github.com`;
    emailVerified = false;
  }


  const desiredRole = req.session.desiredRole || 'USER'; // 기본 USER
  let conn;

  try {
    conn = await pool.getConnection();

    // 이미 연결된 identity 있으면 그 actor로 로그인
    const [identRows] = await conn.execute(
      'SELECT a.actor_id, a.actor_type, a.user_id, a.org_id FROM account_identities ai JOIN actors a ON ai.actor_id=a.actor_id WHERE ai.provider=? AND ai.provider_user_id=?',
      [provider, providerUserId]
    );
    if (identRows.length > 0) {
      const principal = await loadPrincipalByActorId(conn, identRows[0].actor_id);
      return done(null, principal, { newActor: false });
    }

    await conn.beginTransaction();

    // 역할별 분기 생성
    let actorId;

    if (desiredRole === 'USER') {

      // 1) users upsert

      let username = displayName || email.split('@')[0];
      let unique = false;
      while (!unique) {
        const [u] = await conn.execute('SELECT 1 FROM users WHERE username=?', [username]);
        if (u.length === 0) unique = true;
        else username = `${username}_${Math.random().toString(36).substring(2, 7)}`;
      }

      await conn.execute(
        'INSERT INTO users (email, username, profile_image) VALUES (?,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username), profile_image=VALUES(profile_image)',
        [email, username, profileImage]
      );
      const [[user]] = await conn.query('SELECT * FROM users WHERE email=?', [email]);

      // 2) actors(USER)
      const [ar] = await conn.execute(
        'INSERT INTO actors (actor_type, user_id) VALUES (?,?)',
        ['USER', user.user_id]
      );
      actorId = ar.insertId;

    } else if (desiredRole === 'ORG') {

      // 1) organizations upsert (최소 email 기준, 이름은 추후 온보딩에서 수정)
      await conn.execute(
        'INSERT INTO organizations (email, org_name) VALUES (?,?) ON DUPLICATE KEY UPDATE org_name=VALUES(org_name)',
        [email, displayName || email]
      );
      const [[org]] = await conn.query('SELECT * FROM organizations WHERE email=?', [email]);

      // 2) actors(ORG)
      const [ar] = await conn.execute(
        'INSERT INTO actors (actor_type, org_id) VALUES (?,?)',
        ['ORG', org.org_id]
      );
      actorId = ar.insertId;

    } else if (desiredRole === 'ADMIN') {
      if (!isAdminAllowed(email)) {
        throw new Error('관리자 권한이 없습니다.'); // 보안: 화이트리스트 아니면 차단
      }
      const [ar] = await conn.execute(
        'INSERT INTO actors (actor_type) VALUES (?)',
        ['ADMIN']
      );
      actorId = ar.insertId;
    } else {
      throw new Error('Unknown desired role');
    }

    
    await conn.execute(
      'INSERT INTO account_identities (actor_id, provider, provider_user_id, email, is_verified) VALUES (?, ?, ?, ?, ?)',
      [actorId, provider, providerUserId, email, emailVerified]
    );

    await conn.commit();

    const principal = await loadPrincipalByActorId(conn, actorId);
    return done(null, principal, { newActor: true });

  } catch (e) {
    if (conn) await conn.rollback();
    return done(e, null);
  } finally {
    if (conn) conn.release();
  }
}


async function loadPrincipalByActorId(conn, actorId) {
  const [[a]] = await conn.query('SELECT * FROM actors WHERE actor_id=?', [actorId]);
  if (!a) return null;

  let data = { actor_id: a.actor_id, actor_type: a.actor_type };

  if (a.actor_type === 'USER') {
    const [[u]] = await conn.query('SELECT * FROM users WHERE user_id=?', [a.user_id]);
    data.user = u || null;
  } else if (a.actor_type === 'ORG') {
    const [[o]] = await conn.query('SELECT * FROM organizations WHERE org_id=?', [a.org_id]);
    data.org = o || null;
  }


  return data;
}

module.exports = function (passport) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback: true
  },
    (req, accessToken, refreshToken, profile, done) =>
      findOrCreatePrincipal(req, accessToken, refreshToken, profile, done)
  ));

  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/auth/github/callback",
    passReqToCallback: true
  },
    (req, accessToken, refreshToken, profile, done) =>
      findOrCreatePrincipal(req, accessToken, refreshToken, profile, done)
  ));


  passport.serializeUser((principal, done) => {
    done(null, principal.actor_id);
  });

  passport.deserializeUser(async (actorId, done) => {
    try {
      const conn = await pool.getConnection();
      try {
        const principal = await loadPrincipalByActorId(conn, actorId);
        done(null, principal);
      } finally { conn.release(); }
    } catch (err) {
      done(err, null);
    }
  });
};
