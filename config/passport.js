const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const pool = require('./database');

// DB에서 유저를 찾거나 생성하는 함수
async function findOrCreateUser(accessToken, refreshToken, profile, done) {
    const provider = profile.provider.toUpperCase();
    const providerUserId = profile.id;
    const email = profile.emails && profile.emails[0].value;
    const displayName = profile.displayName || profile.username;
    const profileImage = profile.photos && profile.photos[0].value;

    if (!email) {
        return done(new Error('Email not provided by OAuth provider'), null);
    }

    let connection;
    try {
        connection = await pool.getConnection();

        let [rows] = await connection.execute(
            'SELECT * FROM account_identities WHERE provider = ? AND provider_user_id = ?',
            [provider, providerUserId]
        );

        if (rows.length > 0) {
            const identity = rows[0];
            const [userRows] = await connection.execute(
                'SELECT u.* FROM users u JOIN actors a ON u.user_id = a.user_id WHERE a.actor_id = ?',
                [identity.actor_id]
            );
            if (userRows.length > 0) {
                return done(null, userRows[0]);
            } else {
                return done(new Error('User not found for existing identity.'), null);
            }
        }

        await connection.beginTransaction();

        let username = displayName;
        let isUsernameUnique = false;
        while(!isUsernameUnique) {
            const [existingUsers] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
            if (existingUsers.length === 0) {
                isUsernameUnique = true;
            } else {
                username = `${displayName}_${Math.random().toString(36).substring(2, 7)}`;
            }
        }

        await connection.execute(
            'INSERT INTO users (email, username, profile_image) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), profile_image=VALUES(profile_image)',
            [email, username, profileImage]
        );
        
        const [finalUserRows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        const finalUserId = finalUserRows[0].user_id;

        const [actorResult] = await connection.execute(
            'INSERT INTO actors (actor_type, user_id) VALUES (?, ?)',
            ['USER', finalUserId]
        );
        const actorId = actorResult.insertId;

        await connection.execute(
            'INSERT INTO account_identities (actor_id, provider, provider_user_id, email, is_verified) VALUES (?, ?, ?, ?, ?)',
            [actorId, provider, providerUserId, email, true]
        );

        await connection.commit();

        return done(null, finalUserRows[0], { newUser: true });

    } catch (err) {
        if (connection) await connection.rollback();
        return done(err, null);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = function(passport) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback"
      },
      findOrCreateUser
    ));
    
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/auth/github/callback"
      },
      findOrCreateUser
    ));
    
    passport.serializeUser(function(user, done) {
      done(null, user.user_id);
    });
    
    passport.deserializeUser(async function(id, done) {
        try {
            const [rows] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [id]);
            if (rows.length > 0) {
                done(null, rows[0]);
            } else {
                done(null, false);
            }
        } catch (err) {
            done(err, null);
        }
    });
};