function isLoggedIn(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  if (req.path && req.path.startsWith('/api')) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }

  return res.redirect('/');
}

module.exports = { isLoggedIn };
