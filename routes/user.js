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

// GET /api/user/skills
router.get('/skills', async (req, res) => {
    const userId = req.user?.user?.user_id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const [skills] = await pool.execute(
            `SELECT us.user_skill_id, us.proficiency, s.skill_id, s.name as skill_name, sc.category_id, sc.name as category_name
             FROM user_skills us
             JOIN skills s ON us.skill_id = s.skill_id
             JOIN skill_categories sc ON s.category_id = sc.category_id
             WHERE us.user_id = ?`,
            [userId]
        );
        res.status(200).json(skills);
    } catch (error) {
        console.error('Error fetching user skills:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/user/skills
router.post('/skills', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { skill_id, proficiency, custom_skill_name, category_id } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!proficiency) {
        return res.status(400).json({ message: 'Proficiency is required' });
    }

    let finalSkillId = skill_id;

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Handle custom skill
            if (custom_skill_name && category_id) {
                const [result] = await connection.execute(
                    'INSERT INTO skills (category_id, name, is_custom) VALUES (?, ?, ?)',
                    [category_id, custom_skill_name, true]
                );
                finalSkillId = result.insertId;
            }

            if (!finalSkillId) {
                await connection.rollback();
                return res.status(400).json({ message: 'Skill ID or custom skill name/category is required' });
            }

            const [result] = await connection.execute(
                'INSERT INTO user_skills (user_id, skill_id, proficiency) VALUES (?, ?, ?)',
                [userId, finalSkillId, proficiency]
            );

            await connection.commit();
            res.status(201).json({ message: 'Skill added successfully', user_skill_id: result.insertId });

        } catch (error) {
            await connection.rollback();
            // Handle duplicate entry error for custom skills
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'This skill already exists.' });
            }
            throw error; // Re-throw other errors
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error adding user skill:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// DELETE /api/user/skills/:user_skill_id
router.delete('/skills/:user_skill_id', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { user_skill_id } = req.params;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const [result] = await pool.execute(
            'DELETE FROM user_skills WHERE user_skill_id = ? AND user_id = ?',
            [user_skill_id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Skill not found or you do not have permission to delete it.' });
        }

        res.status(200).json({ message: 'Skill deleted successfully' });
    } catch (error) {
        console.error('Error deleting user skill:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/user/security-records
router.get('/security-records', async (req, res) => {
    const userId = req.user?.user?.user_id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const [records] = await pool.execute(
            'SELECT * FROM security_records WHERE user_id = ?',
            [userId]
        );
        res.status(200).json(records);
    } catch (error) {
        console.error('Error fetching security records:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/user/security-records
router.post('/security-records', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { category, title, target, description, url } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!category || !title || !target) {
        return res.status(400).json({ message: 'Category, title, and target are required' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO security_records (user_id, category, title, target, description, url) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, category, title, target, description, url]
        );
        res.status(201).json({ message: 'Security record added successfully', security_record_id: result.insertId });
    } catch (error) {
        console.error('Error adding security record:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/user/security-records/:record_id
router.put('/security-records/:record_id', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { record_id } = req.params;
    const { category, title, target, description, url } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!category || !title || !target) {
        return res.status(400).json({ message: 'Category, title, and target are required' });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE security_records SET category = ?, title = ?, target = ?, description = ?, url = ? WHERE security_record_id = ? AND user_id = ?',
            [category, title, target, description, url, record_id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Security record not found or you do not have permission to update it.' });
        }

        res.status(200).json({ message: 'Security record updated successfully' });
    } catch (error) {
        console.error('Error updating security record:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/user/security-records/:record_id
router.delete('/security-records/:record_id', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { record_id } = req.params;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const [result] = await pool.execute(
            'DELETE FROM security_records WHERE security_record_id = ? AND user_id = ?',
            [record_id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Security record not found or you do not have permission to delete it.' });
        }

        res.status(200).json({ message: 'Security record deleted successfully' });
    } catch (error) {
        console.error('Error deleting security record:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/user/work-experiences
router.get('/work-experiences', async (req, res) => {
    const userId = req.user?.user?.user_id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const [experiences] = await pool.execute(
            'SELECT * FROM user_work_experiences WHERE user_id = ?',
            [userId]
        );
        res.status(200).json(experiences);
    } catch (error) {
        console.error('Error fetching work experiences:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/user/work-experiences
router.post('/work-experiences', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { company_name, role, start_date, end_date, description } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!company_name || !role || !start_date) {
        return res.status(400).json({ message: 'Company name, role, and start date are required' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO user_work_experiences (user_id, company_name, role, start_date, end_date, description) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, company_name, role, start_date, end_date, description]
        );
        res.status(201).json({ message: 'Work experience added successfully', user_work_experience_id: result.insertId });
    } catch (error) {
        console.error('Error adding work experience:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/user/work-experiences/:exp_id
router.put('/work-experiences/:exp_id', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { exp_id } = req.params;
    const { company_name, role, start_date, end_date, description } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!company_name || !role || !start_date) {
        return res.status(400).json({ message: 'Company name, role, and start date are required' });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE user_work_experiences SET company_name = ?, role = ?, start_date = ?, end_date = ?, description = ? WHERE user_work_experience_id = ? AND user_id = ?',
            [company_name, role, start_date, end_date, description, exp_id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Work experience not found or you do not have permission to update it.' });
        }

        res.status(200).json({ message: 'Work experience updated successfully' });
    } catch (error) {
        console.error('Error updating work experience:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/user/work-experiences/:exp_id
router.delete('/work-experiences/:exp_id', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { exp_id } = req.params;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const [result] = await pool.execute(
            'DELETE FROM user_work_experiences WHERE user_work_experience_id = ? AND user_id = ?',
            [exp_id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Work experience not found or you do not have permission to delete it.' });
        }

        res.status(200).json({ message: 'Work experience deleted successfully' });
    } catch (error) {
        console.error('Error deleting work experience:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/user/privacy-settings
router.get('/privacy-settings', async (req, res) => {
    const userId = req.user?.user?.user_id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const [settings] = await pool.execute(
            'SELECT * FROM user_privacy_settings WHERE user_id = ?',
            [userId]
        );
        // Convert array of settings to an object for easier use on the frontend
        const settingsObj = settings.reduce((obj, item) => {
            obj[item.setting_name] = item.is_public;
            return obj;
        }, {});
        res.status(200).json(settingsObj);
    } catch (error) {
        console.error('Error fetching privacy settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/user/privacy-settings
router.put('/privacy-settings', async (req, res) => {
    const userId = req.user?.user?.user_id;
    const { setting_name, is_public } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!setting_name || is_public === undefined) {
        return res.status(400).json({ message: 'Setting name and is_public are required' });
    }

    try {
        // Use INSERT ... ON DUPLICATE KEY UPDATE to either create or update the setting
        await pool.execute(
            `INSERT INTO user_privacy_settings (user_id, setting_name, is_public) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE is_public = ?`,
            [userId, setting_name, is_public, is_public]
        );
        res.status(200).json({ message: 'Privacy setting updated successfully' });
    } catch (error) {
        console.error('Error updating privacy setting:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
