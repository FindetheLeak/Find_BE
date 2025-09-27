// routes/org.js


// 조직명 , 기업 웹사이트 등 관련 온보딩 

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.post('/onboard', async (req, res) => {
  if (req.user.actor_type !== 'ORG') return res.status(400).json({ message: '기업 계정만 가능' });

  const orgId = req.user.org?.org_id;
  const { org_name, website } = req.body;

  if (!orgId) return res.status(400).json({ message: '조직 식별자 없음' });
  if (!org_name) return res.status(400).json({ message: '조직명은 필수' });

  try {
    await pool.execute(
      'UPDATE organizations SET org_name=?, website=?, updated_at=NOW() WHERE org_id=?',
      [org_name, website || null, orgId]
    );
    return res.json({ message: '기업 정보가 업데이트되었습니다.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
