require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');

// 설정 파일 로드
require('./config/passport')(passport);
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const { isLoggedIn } = require('./middlewares/auth');
const app = express();

// CORS 설정
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001', // 허용할 프론트엔드 주소
    credentials: true, // 쿠키를 포함한 요청 허용
};
app.use(cors(corsOptions));

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
app.use('/api', apiRoutes);
// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
