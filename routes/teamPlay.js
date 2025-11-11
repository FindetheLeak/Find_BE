const express = require('express');
const router = express.Router();
const pool = require('../config/database');

function ensureUser(req, res, next) {
  if (!req.user || req.user.actor_type !== 'USER') {
    return res.status(403).json({ message: '일반 회원만 접근 가능합니다.' });
  }
  next();
}

router.use(ensureUser);

const baseTeamSelect = `
  SELECT
    t.team_id,
    t.team_name,
    t.introduction,
    t.owner_actor_id,
    CASE WHEN t.owner_actor_id = ? THEN 1 ELSE 0 END AS is_owner,
    EXISTS(
      SELECT 1 FROM team_members tm WHERE tm.team_id = t.team_id AND tm.actor_id = ?
    ) AS is_member,
    (
      SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.team_id
    ) AS member_count
  FROM teams t
`;

router.get('/teams', async (req, res) => {
  const actorId = req.user.actor_id;
  try {
    const [rows] = await pool.execute(
      `${baseTeamSelect} ORDER BY t.team_id DESC`,
      [actorId, actorId]
    );
    return res.json({ items: rows });
  } catch (error) {
    console.error('Failed to fetch teams', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.get('/teams/:teamId', async (req, res) => {
  const actorId = req.user.actor_id;
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ message: '잘못된 팀 ID 입니다.' });
  }

  try {
    const [[team]] = await pool.execute(
      `${baseTeamSelect} WHERE t.team_id = ?`,
      [actorId, actorId, teamId]
    );

    if (!team) {
      return res.status(404).json({ message: '팀을 찾을 수 없습니다.' });
    }

    const [members] = await pool.execute(
      `
        SELECT
          tm.actor_id,
          tm.role,
          tm.joined_at,
          u.username,
          u.email
        FROM team_members tm
        LEFT JOIN actors a ON a.actor_id = tm.actor_id
        LEFT JOIN users u ON u.user_id = a.user_id
        WHERE tm.team_id = ?
        ORDER BY tm.role DESC, tm.joined_at ASC
      `,
      [teamId]
    );

    return res.json({ team, members });
  } catch (error) {
    console.error('Failed to fetch team detail', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/teams', async (req, res) => {
  const actorId = req.user.actor_id;
  const { team_name: teamName, introduction } = req.body || {};

  const trimmedName = (teamName || '').trim();
  const trimmedIntro = (introduction || '').trim();

  if (!trimmedName) {
    return res.status(400).json({ message: '팀명을 입력하세요.' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [teamInsert] = await conn.execute(
        'INSERT INTO teams (owner_actor_id, team_name, introduction) VALUES (?,?,?)',
        [actorId, trimmedName, trimmedIntro || null]
      );

      await conn.execute(
        'INSERT INTO team_members (team_id, actor_id, role) VALUES (?,?,?)',
        [teamInsert.insertId, actorId, 'OWNER']
      );

      await conn.commit();

      const [[team]] = await conn.execute(
        `${baseTeamSelect} WHERE t.team_id = ?`,
        [actorId, actorId, teamInsert.insertId]
      );

      return res.status(201).json({
        message: '팀이 생성되었습니다.',
        team
      });
    } catch (error) {
      await conn.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: '이미 존재하는 팀명입니다.' });
      }
      console.error('Failed to create team', error);
      return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Failed to create team connection', err);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.put('/teams/:teamId', async (req, res) => {
  const actorId = req.user.actor_id;
  const teamId = Number(req.params.teamId);
  const { team_name: teamName, introduction } = req.body || {};

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ message: '잘못된 팀 ID 입니다.' });
  }

  const trimmedName = (teamName || '').trim();
  const trimmedIntro = (introduction || '').trim();

  if (!trimmedName) {
    return res.status(400).json({ message: '팀명을 입력하세요.' });
  }

  try {
    const [result] = await pool.execute(
      'UPDATE teams SET team_name = ?, introduction = ?, updated_at = NOW() WHERE team_id = ? AND owner_actor_id = ?',
      [trimmedName, trimmedIntro || null, teamId, actorId]
    );

    if (result.affectedRows === 0) {
      return res.status(403).json({ message: '팀 수정 권한이 없습니다.' });
    }

    const [[team]] = await pool.execute(
      `${baseTeamSelect} WHERE t.team_id = ?`,
      [actorId, actorId, teamId]
    );

    return res.json({ message: '팀 정보가 수정되었습니다.', team });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '이미 존재하는 팀명입니다.' });
    }
    console.error('Failed to update team', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.delete('/teams/:teamId', async (req, res) => {
  const actorId = req.user.actor_id;
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ message: '잘못된 팀 ID 입니다.' });
  }

  try {
    const [result] = await pool.execute(
      'DELETE FROM teams WHERE team_id = ? AND owner_actor_id = ?',
      [teamId, actorId]
    );

    if (result.affectedRows === 0) {
      return res.status(403).json({ message: '팀 삭제 권한이 없습니다.' });
    }

    return res.json({ message: '팀이 삭제되었습니다.' });
  } catch (error) {
    console.error('Failed to delete team', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/teams/:teamId/join', async (req, res) => {
  const actorId = req.user.actor_id;
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ message: '잘못된 팀 ID 입니다.' });
  }

  try {
    const [[team]] = await pool.execute(
      'SELECT team_id, owner_actor_id FROM teams WHERE team_id = ?',
      [teamId]
    );
    if (!team) {
      return res.status(404).json({ message: '팀을 찾을 수 없습니다.' });
    }

    if (team.owner_actor_id === actorId) {
      return res.status(400).json({ message: '팀 소유자는 이미 팀에 속해 있습니다.' });
    }

    const [[existing]] = await pool.execute(
      'SELECT role FROM team_members WHERE team_id = ? AND actor_id = ?',
      [teamId, actorId]
    );
    if (existing) {
      return res.status(409).json({ message: '이미 팀에 가입되어 있습니다.' });
    }

    await pool.execute(
      'INSERT INTO team_members (team_id, actor_id, role) VALUES (?,?,?)',
      [teamId, actorId, 'MEMBER']
    );

    return res.status(201).json({ message: '팀에 가입되었습니다.' });
  } catch (error) {
    console.error('Failed to join team', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
