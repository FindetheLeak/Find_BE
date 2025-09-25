const express = require('express');
const passport = require('passport');
const router = express.Router();

// 인증 콜백 공통 핸들러
function handleAuthCallback(provider) {
    return (req, res, next) => {
        passport.authenticate(provider, (err, user, info) => {
            if (err) { return next(err); }
            if (!user) { return res.redirect('/'); }
            req.logIn(user, (err) => {
                if (err) { return next(err); }
                if (info && info.newUser) {
                    return res.redirect('/onboarding.html');
                }
                return res.redirect('/profile.html');
            });
        })(req, res, next);
    };
}

// Google 인증 라우트
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', handleAuthCallback('google'));

// GitHub 인증 라우트
router.get('/github', passport.authenticate('github', { scope: [ 'user:email' ] }));
router.get('/github/callback', handleAuthCallback('github'));

// 로그아웃
router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

module.exports = router;
