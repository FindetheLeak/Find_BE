const express = require('express');
const router = express.Router();

const publicRoutes = require('../public');
const searchRoutes = require('../search');
const userRoutes = require('../user');
const orgRoutes = require('../org');
const bugBountyRoutes = require('../bugBounty');
const adminNoticeRoutes = require('../adminNotices');
const orgDashboardRoutes = require('../orgDashboard');
const teamPlayRoutes = require('../teamPlay');

const { isLoggedIn } = require('../../middlewares/auth');

router.use('/', publicRoutes);
router.use('/', searchRoutes);
router.use('/user', isLoggedIn, userRoutes);
router.use('/org/bug-bounty', isLoggedIn, bugBountyRoutes);
router.use('/admin/notices', isLoggedIn, adminNoticeRoutes);
router.use('/org/dashboard', orgDashboardRoutes);
router.use('/team-play', isLoggedIn, teamPlayRoutes);
router.use('/org', isLoggedIn, orgRoutes);

module.exports = router;
