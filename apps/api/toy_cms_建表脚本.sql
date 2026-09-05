-- ============================================================
--  Toy CMS 数据库建表脚本
--  数据库：MySQL 8.0+   字符集：utf8mb4
--  用途：一键复现 toy_cms 全部数据表结构
--  执行方式：CREATE DATABASE toy_cms CHARACTER SET utf8mb4;
--            选中该库后执行本脚本即可
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- 1. 文章分类 ----------
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
    id          INT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)  NOT NULL,
    sort        INT          DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 2. 文章 ----------
DROP TABLE IF EXISTS articles;
CREATE TABLE articles (
    id          INT          NOT NULL AUTO_INCREMENT,
    title       VARCHAR(100),
    content     TEXT,
    category_id INT,
    status      INT          DEFAULT 1,          -- 1=发布 0=草稿
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_articles_category (category_id),
    CONSTRAINT fk_articles_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 3. 后台用户 ----------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id        INT     NOT NULL AUTO_INCREMENT,
    username  VARCHAR(50)  NOT NULL,
    password  VARCHAR(255),
    role      VARCHAR(20) DEFAULT 'editor',
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 4. 媒体库（私有存储） ----------
DROP TABLE IF EXISTS media_files;
CREATE TABLE media_files (
    id            INT     NOT NULL AUTO_INCREMENT,
    filename      VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_type     VARCHAR(100),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_media_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 5. 审计日志（中间件落库） ----------
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
    id          INT     NOT NULL AUTO_INCREMENT,
    path        VARCHAR(255),
    method      VARCHAR(10),
    status_code INT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 6. 标签 ----------
DROP TABLE IF EXISTS tags;
CREATE TABLE tags (
    id   INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(30) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 7. 文章-标签关联 ----------
DROP TABLE IF EXISTS article_tags;
CREATE TABLE article_tags (
    id         INT NOT NULL AUTO_INCREMENT,
    article_id INT,
    tag_id     INT,
    PRIMARY KEY (id),
    KEY idx_article_tags_article (article_id),
    KEY idx_article_tags_tag (tag_id),
    CONSTRAINT fk_article_tags_article FOREIGN KEY (article_id) REFERENCES articles (id),
    CONSTRAINT fk_article_tags_tag     FOREIGN KEY (tag_id)     REFERENCES tags (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 8. 评论 ----------
DROP TABLE IF EXISTS comments;
CREATE TABLE comments (
    id         INT NOT NULL AUTO_INCREMENT,
    article_id INT,
    content    TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_comments_article (article_id),
    CONSTRAINT fk_comments_article FOREIGN KEY (article_id) REFERENCES articles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 9. 系统设置 ----------
DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
    id    INT NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(50) NOT NULL,
    value VARCHAR(255),
    PRIMARY KEY (id),
    UNIQUE KEY uk_settings_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 初始化系统设置示例数据
INSERT INTO settings (`key`, value) VALUES ('site_title', 'WEMOVESPORTS') ON DUPLICATE KEY UPDATE value = VALUES(value);

-- ---------- 10. 联系表单 / 工单 ----------
DROP TABLE IF EXISTS contact_forms;
CREATE TABLE contact_forms (
    id         INT     NOT NULL AUTO_INCREMENT,
    name       VARCHAR(50),
    phone      VARCHAR(20),
    email      VARCHAR(100),
    message    TEXT,
    status     INT     DEFAULT 0,              -- 0:新提交 1:处理中 2:已解决 3:已关闭
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_contact_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
