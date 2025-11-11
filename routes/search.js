const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 단순 헬스체크 (API 존재 확인용)
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 프로그램 5건 조회 (조직명 포함)
// 테이블/컬럼: programs(program_id, org_id, name, description, visibility, allow_public_disclosure),
// organizations(org_id, org_name)
router.get('/programs', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        p.program_id,
        p.name,
        p.description,
        p.visibility,
        p.allow_public_disclosure,
        o.org_name
      FROM programs p
      JOIN organizations o ON o.org_id = p.org_id
      ORDER BY p.program_id DESC
      LIMIT 5
      `
    );
    res.json({ items: rows, total: rows.length }); // "존재 확인" 목적이라 total=rows.length로 간단 처리
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
