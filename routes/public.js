const express = require('express');
const router = express.Router();
const pool = require('../config/database');

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
