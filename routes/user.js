const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 이 라우터의 모든 경로는 /api/user 로 시작한다고 가정

// POST /api/user/onboard
router.post('/onboard', async (req, res) => {

    // isLoggedIn 미들웨어는 server.js에서 적용
    // 현재 세션은 actor 기반 principal: { actor_id, actor_type, user?, org? }
    const { username } = req.body;
    const birthday = (req.body?.birthday ?? null) || null;      // '' -> null
    const phone_number = (req.body?.phone_number ?? null) || null;  // '' -> null
    const github_id = (req.body?.github_id ?? null) || null;     // '' -> null
    const userId = req.user?.user?.user_id; // ✅ actor 기반에서 USER의 PK


    if (req.user?.actor_type !== 'USER' || !userId) {
        return res.status(400).json({ message: '개인(일반인) 계정에서만 온보딩 가능합니다.' });
    }


    try {
        // 닉네임 중복 확인
        const [existingUsers] = await pool.execute(
            'SELECT * FROM users WHERE username = ? AND user_id != ?',
            [username, userId]
        );
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
        }

        await pool.execute(
            'UPDATE users SET username = ?, birthday = ?, phone_number = ?, github_id = ?, updated_at = NOW() WHERE user_id = ?',
            [username, birthday, phone_number, github_id, userId]
        );
        res.status(200).json({ message: '성공적으로 업데이트되었습니다.' });
    } catch (error) {
        console.error('Onboarding error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
