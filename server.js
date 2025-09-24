require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');


/* 2025-09-24 00:42 변경사항 

*/






// 설정 파일 로드
require('./config/passport')(passport);
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const orgRoutes = require('./routes/org');
const app = express();

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_secret_key', // 프로덕션에서는 .env 파일 등으로 관리하세요.
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

// 로그인 확인 미들웨어
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    // API 요청에 대해 401 Unauthenticated 응답
    if (req.path.startsWith('/api')) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }
    // 그 외에는 로그인 페이지로 리디렉션
    res.redirect('/');
}

// 정적 파일 및 뷰 라우트
app.use(express.static(path.join(__dirname, 'views')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/profile', isLoggedIn, (req, res) => {
    // 이 라우트는 /profile.html 에서 fetch 요청을 보내는 API 역할을 합니다.
    res.json(req.user);
});

// 분리된 라우터 마운트
app.use('/auth', authRoutes);
app.use('/api/user', isLoggedIn, userRoutes); // /api/user 경로의 모든 라우트에 로그인 확인 적용
app.use('/api/org',  isLoggedIn, orgRoutes);
// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
