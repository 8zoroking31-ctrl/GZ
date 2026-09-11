-- Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(50) NOT NULL,
  channel_id VARCHAR(50) NOT NULL UNIQUE,
  ticket_number INT NOT NULL,
  member_id VARCHAR(50) NOT NULL,
  category VARCHAR(100) NOT NULL,
  panel_type VARCHAR(50) DEFAULT 'general',
  status VARCHAR(20) DEFAULT 'open',
  claimed_by VARCHAR(50),
  closed_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  UNIQUE(guild_id, ticket_number)
);

-- Ticket Blacklist Table
CREATE TABLE IF NOT EXISTS ticket_blacklist (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);

-- Ticket Panels Table
CREATE TABLE IF NOT EXISTS ticket_panels (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(50) NOT NULL,
  channel_id VARCHAR(50) NOT NULL,
  panel_name VARCHAR(100) NOT NULL,
  categories JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, panel_name)
);

-- Boost Config Table
CREATE TABLE IF NOT EXISTS boost_config (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(50) NOT NULL UNIQUE,
  role1 VARCHAR(50),
  role2 VARCHAR(50),
  role3 VARCHAR(50),
  role4 VARCHAR(50),
  role5 VARCHAR(50),
  log_channel VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Boosts Table
CREATE TABLE IF NOT EXISTS user_boosts (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  boost_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);
