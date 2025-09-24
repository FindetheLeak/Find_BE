const express = require('express');
const passport = require('passport');
const router = express.Router();

/* 2025-09-23 18:00
 
1. 페이지 관리자 / 기업 / 일반(제보자) 로그인 흐름 분리 

*/


// 역할 세팅 
function setRole(role) {
  return (req, res, next) => {
    req.session.desiredRole = role; // 'USER' | 'ORG' | 'ADMIN'
    next();
  };
}

// 공통 콜백 
function handleAuthCallback(provider) {
  return (req, res, next) => {
    passport.authenticate(provider, (err, principal, info) => {
      if (err) return next(err);
      if (!principal) return res.redirect('/');

      req.logIn(principal, (err) => {
        if (err) return next(err);

        // 역할별 온보딩/리다이렉트
        if (info && info.newActor) {
          if (principal.actor_type === 'ORG') return res.redirect('/onboarding_org.html');
          if (principal.actor_type === 'USER') return res.redirect('/onboarding.html');
        }
        // 관리자/기타는 프로필 또는 대시보드
        return res.redirect('/profile.html');
      });
    })(req, res, next);
  };
}

// 역할별 진입
router.get('/google/user', setRole('USER'), passport.authenticate('google', { scope: ['profile','email'] }));
router.get('/google/org',  setRole('ORG'),  passport.authenticate('google', { scope: ['profile','email'] }));
router.get('/google/admin',setRole('ADMIN'),passport.authenticate('google', { scope: ['profile','email'] }));

router.get('/github/user', setRole('USER'), passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/org',  setRole('ORG'),  passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/admin',setRole('ADMIN'),passport.authenticate('github', { scope: ['user:email'] }));


// 콜백
router.get('/google/callback', handleAuthCallback('google'));
router.get('/github/callback', handleAuthCallback('github'));

// 로그아웃
router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

module.exports = router;
