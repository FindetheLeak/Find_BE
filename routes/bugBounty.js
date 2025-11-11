const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 기업 회원 전용 버그바운티 프로그램 등록
router.post('/programs', async (req, res) => {
  if (!req.user || req.user.actor_type !== 'ORG') {
    return res.status(403).json({ message: '기업 회원만 접근 가능합니다.' });
  }

  const orgId = req.user.org?.org_id;
  if (!orgId) {
    return res.status(400).json({ message: '기업 정보가 없습니다.' });
  }

  const { program_name: programName, program_description: programDescription } = req.body;

  if (!programName || !programDescription) {
    return res.status(400).json({ message: '프로그램명과 내용을 모두 입력하세요.' });
  }

  try {
    const [insertResult] = await pool.execute(
      `
        INSERT INTO bug_bounty_programs (org_id, program_name, program_description, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
      `,
      [orgId, programName, programDescription]
    );

    const [rows] = await pool.execute(
      `
        SELECT program_id, program_name, program_description, created_at
        FROM bug_bounty_programs
        WHERE program_id = ?
      `,
      [insertResult.insertId]
    );

    return res.status(201).json({
      message: '버그바운티 프로그램이 등록되었습니다.',
      program: rows[0]
    });
  } catch (error) {
    console.error('Failed to insert bug bounty program', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '동일한 프로그램명이 이미 존재합니다.' });
    }

    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 기업 회원 전용 버그바운티 프로그램 검색
router.get('/programs/search', async (req, res) => {
  if (!req.user || req.user.actor_type !== 'ORG') {
    return res.status(403).json({ message: '기업 회원만 접근 가능합니다.' });
  }

  const orgId = req.user.org?.org_id;
  if (!orgId) {
    return res.status(400).json({ message: '기업 정보가 없습니다.' });
  }

  const keyword = (req.query.q || '').trim();
  if (!keyword) {
    return res.status(400).json({ message: '검색어를 입력하세요.' });
  }

  try {
    const likeKeyword = `%${keyword}%`;
    const [rows] = await pool.execute(
      `
        SELECT program_id, program_name, program_description, created_at
        FROM bug_bounty_programs
        WHERE org_id = ?
          AND (program_name LIKE ? OR program_description LIKE ?)
        ORDER BY created_at DESC
      `,
      [orgId, likeKeyword, likeKeyword]
    );

    return res.json({
      total: rows.length,
      items: rows
    });
  } catch (error) {
    console.error('Failed to search bug bounty programs', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
