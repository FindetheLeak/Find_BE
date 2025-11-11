const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const dashboardFields = [
  'program_intro',
  'bounty_info',
  'severity_info',
  'org_notice',
  'submission_targets',
  'limitations',
  'hall_of_fame',
  'qa_board'
];

function sanitizeField(value) {
  if (value === undefined || value === null) return null;
  return String(value).slice(0, 255);
}

function ensureOrgSession(req) {
  if (!req.user || req.user.actor_type !== 'ORG') {
    return { ok: false, status: 403, message: '기업 회원만 수정할 수 있습니다.' };
  }
  if (!req.user.org?.org_id) {
    return { ok: false, status: 400, message: '기업 정보가 없습니다.' };
  }
  return { ok: true, orgId: req.user.org.org_id };
}

router.get('/organizations', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT org_id, org_name FROM organizations ORDER BY org_name ASC'
    );
    return res.json({ items: rows });
  } catch (error) {
    console.error('Failed to fetch organizations for dashboard', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.get('/organizations/:orgId', async (req, res) => {
  const orgId = Number(req.params.orgId);
  if (!Number.isInteger(orgId) || orgId <= 0) {
    return res.status(400).json({ message: '잘못된 조직 ID 입니다.' });
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT
          o.org_id,
          o.org_name,
          o.website,
          d.program_intro,
          d.bounty_info,
          d.severity_info,
          d.org_notice,
          d.submission_targets,
          d.limitations,
          d.hall_of_fame,
          d.qa_board,
          d.updated_at
        FROM organizations o
        LEFT JOIN org_dashboard_details d ON d.org_id = o.org_id
        WHERE o.org_id = ?
        LIMIT 1
      `,
      [orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: '해당 기업을 찾을 수 없습니다.' });
    }

    const row = rows[0];
    const dashboard = {};
    dashboardFields.forEach((field) => {
      dashboard[field] = row[field] || '';
    });
    dashboard.updated_at = row.updated_at || null;

    return res.json({
      org: {
        org_id: row.org_id,
        org_name: row.org_name,
        website: row.website
      },
      dashboard
    });
  } catch (error) {
    console.error('Failed to fetch organization dashboard detail', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.put('/organizations/:orgId', async (req, res) => {
  const orgId = Number(req.params.orgId);
  if (!Number.isInteger(orgId) || orgId <= 0) {
    return res.status(400).json({ message: '잘못된 조직 ID 입니다.' });
  }

  const sessionCheck = ensureOrgSession(req);
  if (!sessionCheck.ok) {
    return res.status(sessionCheck.status).json({ message: sessionCheck.message });
  }
  if (sessionCheck.orgId !== orgId) {
    return res.status(403).json({ message: '본인 기업만 수정할 수 있습니다.' });
  }

  try {
    const payload = dashboardFields.map((field) => sanitizeField(req.body?.[field]));

    await pool.execute(
      `
        INSERT INTO org_dashboard_details (
          org_id,
          program_intro,
          bounty_info,
          severity_info,
          org_notice,
          submission_targets,
          limitations,
          hall_of_fame,
          qa_board
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          program_intro = VALUES(program_intro),
          bounty_info = VALUES(bounty_info),
          severity_info = VALUES(severity_info),
          org_notice = VALUES(org_notice),
          submission_targets = VALUES(submission_targets),
          limitations = VALUES(limitations),
          hall_of_fame = VALUES(hall_of_fame),
          qa_board = VALUES(qa_board),
          updated_at = CURRENT_TIMESTAMP
      `,
      [orgId, ...payload]
    );

    const [rows] = await pool.execute(
      `
        SELECT
          d.program_intro,
          d.bounty_info,
          d.severity_info,
          d.org_notice,
          d.submission_targets,
          d.limitations,
          d.hall_of_fame,
          d.qa_board,
          d.updated_at
        FROM org_dashboard_details d
        WHERE d.org_id = ?
      `,
      [orgId]
    );

    const dashboard = {};
    dashboardFields.forEach((field) => {
      dashboard[field] = rows[0]?.[field] || '';
    });
    dashboard.updated_at = rows[0]?.updated_at || null;

    return res.json({
      message: '기업 대시보드 정보가 저장되었습니다.',
      dashboard
    });
  } catch (error) {
    console.error('Failed to save organization dashboard detail', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
