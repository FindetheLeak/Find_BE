const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 현재 세션 상태 반환
router.get('/session', (req, res) => {
    const isLoggedIn = typeof req.isAuthenticated === 'function' && req.isAuthenticated();

    if (!isLoggedIn || !req.user) {
        return res.json({ logged_in: false });
    }

    const actorType = req.user.actor_type;
    const sessionPayload = {
        logged_in: true,
        actor_type: actorType,
        actor_id: req.user.actor_id,
        user: null,
        org: null
    };

    if (actorType === 'ORG' && req.user.org) {
        sessionPayload.org = {
            org_id: req.user.org.org_id,
            org_name: req.user.org.org_name,
            email: req.user.org.email
        };
    } else if (actorType === 'USER' && req.user.user) {
        sessionPayload.user = {
            user_id: req.user.user.user_id,
            username: req.user.user.username,
            email: req.user.user.email
        };
    }

    return res.json(sessionPayload);
});

// GET /api/skills
router.get('/skills', async (req, res) => {
    try {
        const [categories] = await pool.execute('SELECT * FROM skill_categories');
        const [skills] = await pool.execute('SELECT * FROM skills WHERE is_custom = false');

        const categorizedSkills = categories.map(category => ({
            ...category,
            skills: skills.filter(skill => skill.category_id === category.category_id)
        }));

        res.status(200).json(categorizedSkills);
    } catch (error) {
        console.error('Error fetching skills:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
