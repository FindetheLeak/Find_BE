-- 가정: V1__init.sql ~ V4__create_skill_categories_and_update_skills.sql 적용 완료
-- MySQL 8.0.40
SET NAMES utf8mb4;
START TRANSACTION;

-- 1) 조직 5개
INSERT INTO organizations (email, org_name, status, website)
VALUES ('security@acme.example', 'Acme Corp', 'ACTIVE', 'https://www.acme.example');
SET @org_acme := LAST_INSERT_ID();

INSERT INTO organizations (email, org_name, status, website)
VALUES ('security@nexon.com', 'NEXON', 'ACTIVE', 'https://www.nexon.com');
SET @org_nexon := LAST_INSERT_ID();

INSERT INTO organizations (email, org_name, status, website)
VALUES ('security@kakao.com', 'Kakao', 'ACTIVE', 'https://www.kakao.com');
SET @org_kakao := LAST_INSERT_ID();

INSERT INTO organizations (email, org_name, status, website)
VALUES ('security@linecorp.com', 'LINE', 'ACTIVE', 'https://line.me');
SET @org_line := LAST_INSERT_ID();

INSERT INTO organizations (email, org_name, status, website)
VALUES ('security@coupang.com', 'Coupang', 'ACTIVE', 'https://www.coupang.com');
SET @org_coupang := LAST_INSERT_ID();

-- 2) 바운티 프로그램 5개 (모두 PUBLIC)
INSERT INTO programs (org_id, name, description, visibility, allow_public_disclosure)
VALUES
(@org_acme,   'Acme Bug Bounty', '웹/모바일/API 전반에 대한 Acme 공개 버그바운티', 'PUBLIC', 1);
SET @p_acme := LAST_INSERT_ID();

INSERT INTO programs (org_id, name, description, visibility, allow_public_disclosure)
VALUES
(@org_nexon,  'NEXON VDP', '게임 서비스 전반 취약점 제보 프로그램(보상은 케이스별 산정)', 'PUBLIC', 1);
SET @p_nexon := LAST_INSERT_ID();

INSERT INTO programs (org_id, name, description, visibility, allow_public_disclosure)
VALUES
(@org_kakao,  'Kakao Bug Bounty', '카카오 도메인/모바일 앱 대상 취약점 바운티', 'PUBLIC', 1);
SET @p_kakao := LAST_INSERT_ID();

INSERT INTO programs (org_id, name, description, visibility, allow_public_disclosure)
VALUES
(@org_line,   'LINE Security Program', '메신저/플랫폼/개발자 API 보안 이슈 제보', 'PUBLIC', 0);
SET @p_line := LAST_INSERT_ID();

INSERT INTO programs (org_id, name, description, visibility, allow_public_disclosure)
VALUES
(@org_coupang,'Coupang Bug Bounty', '이커머스·로지스틱스 시스템 취약점 제보 및 보상', 'PUBLIC', 1);
SET @p_coupang := LAST_INSERT_ID();

-- 3) 프로그램 스코프(각 2~3개)
INSERT INTO program_scopes (program_id, scope_name, in_scope, notes) VALUES
(@p_acme,    'www.acme.example',           1, '메인 웹'),
(@p_acme,    'api.acme.example',           1, 'Public API v1~v3'),
(@p_acme,    'm.acme.example',             1, '모바일 웹');

INSERT INTO program_scopes (program_id, scope_name, in_scope, notes) VALUES
(@p_nexon,   '*.nexon.com',                1, '게임/런처/계정'),
(@p_nexon,   'api.nexon.com',              1, '공개 API');

INSERT INTO program_scopes (program_id, scope_name, in_scope, notes) VALUES
(@p_kakao,   '*.kakao.com',                1, '포털/계정/스토리'),
(@p_kakao,   'api.kakao.com',              1, '개발자 API');

INSERT INTO program_scopes (program_id, scope_name, in_scope, notes) VALUES
(@p_line,    '*.line.me',                  1, '메신저/타임라인/스토어'),
(@p_line,    'developers.line.biz',        1, 'Developers 콘솔');

INSERT INTO program_scopes (program_id, scope_name, in_scope, notes) VALUES
(@p_coupang, '*.coupang.com',              1, '쇼핑/결제/계정'),
(@p_coupang, 'api.coupang.com',            1, '오픈 API');

-- 4) 프로그램 규정(각 최소 3개: 허용/금지/보상)
-- Acme
INSERT INTO program_rules (program_id, rule_type, content) VALUES
(@p_acme,  'ALLOWED',     'OWASP Top 10, 인증/인가, 서버측 취약점 테스트 허용'),
(@p_acme,  'DISALLOWED',  'DDoS, 물리적 침투, 사회공학 금지'),
(@p_acme,  'REWARD',      '심각도 기반 KRW 100,000 ~ 3,000,000 보상'),
(@p_acme,  'DISCLOSURE',  '패치 후 또는 90일 경과 시 공개 가능(협의 필요)');

-- NEXON
INSERT INTO program_rules (program_id, rule_type, content) VALUES
(@p_nexon, 'ALLOWED',     '게임/계정/런처 취약점 신고 허용'),
(@p_nexon, 'DISALLOWED',  '실제 유저 데이터 접근/변조, 서비스 방해 금지'),
(@p_nexon, 'REWARD',      '케이스별/심각도별 보상, 중복 제보는 보상 제외');

-- Kakao
INSERT INTO program_rules (program_id, rule_type, content) VALUES
(@p_kakao, 'ALLOWED',     '카카오 도메인/모바일 앱/개발자 API 취약점 허용'),
(@p_kakao, 'DISALLOWED',  '스팸·피싱, 자동화 대량 트래픽, 규정 위반 테스트 금지'),
(@p_kakao, 'REWARD',      '심각도 기반 내부 정책에 따라 보상');

-- LINE
INSERT INTO program_rules (program_id, rule_type, content) VALUES
(@p_line,  'ALLOWED',     '메신저/플랫폼/SDK 관련 보안 이슈 신고'),
(@p_line,  'DISALLOWED',  '서비스 중단 유발, 개인정보 대량 유출 시도 금지'),
(@p_line,  'REWARD',      '공개 공개정책에 따른 보상(일부 케이스 비공개)');

-- Coupang
INSERT INTO program_rules (program_id, rule_type, content) VALUES
(@p_coupang,'ALLOWED',    '결제/주문/계정 도메인 취약점 테스트 허용'),
(@p_coupang,'DISALLOWED', '실거래 유발, 물류센터·물리 장비 테스트 금지'),
(@p_coupang,'REWARD',     '심각도 기반 최대 KRW 5,000,000까지 보상');

COMMIT;

-- 5) 검증: 프로그램 5건 조회
-- (필요 시 검색 기능 개발용 샘플 쿼리)
-- 전체 목록
SELECT p.program_id, o.org_name, p.name, p.visibility, p.allow_public_disclosure
FROM programs p
JOIN organizations o ON o.org_id = p.org_id
ORDER BY p.program_id;

-- 키워드 기반 간단 검색 예시(이름/설명/스코프/룰에서 검색)
-- 예: 'api' 키워드
SELECT DISTINCT p.program_id, o.org_name, p.name
FROM programs p
JOIN organizations o ON o.org_id = p.org_id
LEFT JOIN program_scopes s ON s.program_id = p.program_id
LEFT JOIN program_rules  r ON r.program_id = p.program_id
WHERE CONCAT_WS(' ', p.name, p.description, s.scope_name, r.content) LIKE '%api%'
ORDER BY p.program_id;
