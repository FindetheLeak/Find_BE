const express = require('express');
const router = express.Router();
const pool = require('../config/database');

function ensureAdmin(req, res, next) {
  if (!req.user || req.user.actor_type !== 'ADMIN') {
    return res.status(403).json({ message: '관리자만 접근 가능합니다.' });
  }
  next();
}

router.use(ensureAdmin);

const baseNoticeSelectQuery = `
  SELECT
    notice_id,
    title,
    content,
    created_by_actor_id,
    updated_by_actor_id,
    created_at,
    updated_at
  FROM admin_notices
`;

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `${baseNoticeSelectQuery} ORDER BY created_at DESC`
    );

    return res.json({
      total: rows.length,
      items: rows
    });
  } catch (error) {
    console.error('Failed to fetch admin notices', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/', async (req, res) => {
  const { title, content } = req.body || {};
  const trimmedTitle = (title || '').trim();
  const trimmedContent = (content || '').trim();

  if (!trimmedTitle || !trimmedContent) {
    return res.status(400).json({ message: '제목과 내용을 모두 입력하세요.' });
  }

  try {
    const adminActorId = req.user.actor_id;
    const [insertResult] = await pool.execute(
      `
        INSERT INTO admin_notices (title, content, created_by_actor_id, updated_by_actor_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `,
      [trimmedTitle, trimmedContent, adminActorId, adminActorId]
    );

    const [rows] = await pool.execute(
      `${baseNoticeSelectQuery} WHERE notice_id = ?`,
      [insertResult.insertId]
    );

    return res.status(201).json({
      message: '공지사항이 등록되었습니다.',
      notice: rows[0]
    });
  } catch (error) {
    console.error('Failed to create admin notice', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.put('/:noticeId', async (req, res) => {
  const noticeId = Number(req.params.noticeId);
  if (!Number.isInteger(noticeId) || noticeId <= 0) {
    return res.status(400).json({ message: '잘못된 공지 ID 입니다.' });
  }

  const { title, content } = req.body || {};
  const trimmedTitle = (title || '').trim();
  const trimmedContent = (content || '').trim();

  if (!trimmedTitle || !trimmedContent) {
    return res.status(400).json({ message: '제목과 내용을 모두 입력하세요.' });
  }

  try {
    const adminActorId = req.user.actor_id;
    const [result] = await pool.execute(
      `
        UPDATE admin_notices
        SET title = ?, content = ?, updated_by_actor_id = ?, updated_at = NOW()
        WHERE notice_id = ?
      `,
      [trimmedTitle, trimmedContent, adminActorId, noticeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '존재하지 않는 공지사항입니다.' });
    }

    const [rows] = await pool.execute(
      `${baseNoticeSelectQuery} WHERE notice_id = ?`,
      [noticeId]
    );

    return res.json({
      message: '공지사항이 수정되었습니다.',
      notice: rows[0]
    });
  } catch (error) {
    console.error('Failed to update admin notice', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.delete('/:noticeId', async (req, res) => {
  const noticeId = Number(req.params.noticeId);
  if (!Number.isInteger(noticeId) || noticeId <= 0) {
    return res.status(400).json({ message: '잘못된 공지 ID 입니다.' });
  }

  try {
    const [result] = await pool.execute(
      'DELETE FROM admin_notices WHERE notice_id = ?',
      [noticeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '존재하지 않는 공지사항입니다.' });
    }

    return res.json({ message: '공지사항이 삭제되었습니다.' });
  } catch (error) {
    console.error('Failed to delete admin notice', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
