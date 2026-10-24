CREATE DATABASE IF NOT EXISTS haparty CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE haparty;
CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) NOT NULL UNIQUE,
 email VARCHAR(120) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL,
 role ENUM('user','admin') NOT NULL DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS games (
 id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
 image_url VARCHAR(500), description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS parties (
 id INT AUTO_INCREMENT PRIMARY KEY, owner_id INT NOT NULL, game_id INT NOT NULL,
 name VARCHAR(120) NOT NULL, max_members INT NOT NULL DEFAULT 5, play_time DATETIME NOT NULL,
 description TEXT, status ENUM('open','closed') NOT NULL DEFAULT 'open',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE RESTRICT,
 INDEX idx_party_game(game_id), INDEX idx_party_time(play_time), INDEX idx_party_status(status)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS party_members (
 id INT AUTO_INCREMENT PRIMARY KEY, party_id INT NOT NULL, user_id INT NOT NULL,
 joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_party_member(party_id,user_id),
 FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX idx_member_user(user_id)
) ENGINE=InnoDB;
INSERT IGNORE INTO games(name,image_url,description) VALUES
('DOTA 2','https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg','เกม MOBA ที่ต้องร่วมมือกันเป็นทีม'),
('League of Legends','https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80','เกม MOBA สำหรับเล่นเป็นทีม'),
('Minecraft','https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=900&q=80','เกมสร้างสรรค์และเอาชีวิตรอด'),
('PUBG','https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80','เกม Battle Royale'),
('VALORANT','https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80','เกมยิงเชิงกลยุทธ์แบบทีม');
