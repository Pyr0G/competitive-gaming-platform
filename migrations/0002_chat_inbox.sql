ALTER TABLE users ADD COLUMN unread_count INTEGER NOT NULL DEFAULT 0 CHECK(unread_count >= 0);
ALTER TABLE conversation_reads ADD COLUMN unread_count INTEGER NOT NULL DEFAULT 0 CHECK(unread_count >= 0);
ALTER TABLE conversation_reads ADD COLUMN latest_message_id INTEGER NOT NULL DEFAULT 0 CHECK(latest_message_id >= 0);

INSERT OR IGNORE INTO conversation_reads(user_id, conversation_id)
SELECT user_low, id FROM conversations
UNION ALL SELECT user_high, id FROM conversations;

UPDATE conversation_reads SET
  latest_message_id = COALESCE((SELECT MAX(id) FROM messages WHERE conversation_id = conversation_reads.conversation_id), 0),
  unread_count = (SELECT COUNT(*) FROM messages
    WHERE conversation_id = conversation_reads.conversation_id
      AND sender_id <> conversation_reads.user_id AND id > conversation_reads.last_message_id);

UPDATE users SET unread_count = COALESCE((SELECT SUM(unread_count) FROM conversation_reads WHERE user_id = users.id), 0);

CREATE INDEX conversation_reads_inbox ON conversation_reads(user_id, latest_message_id DESC, conversation_id DESC);
CREATE INDEX conversation_reads_conversation ON conversation_reads(conversation_id);

CREATE TRIGGER conversation_inbox_created AFTER INSERT ON conversations
BEGIN
  INSERT INTO conversation_reads(user_id, conversation_id) VALUES(NEW.user_low, NEW.id), (NEW.user_high, NEW.id);
END;

CREATE TRIGGER message_inbox_updated AFTER INSERT ON messages
BEGIN
  UPDATE conversation_reads SET latest_message_id = NEW.id,
    unread_count = unread_count + CASE WHEN user_id <> NEW.sender_id THEN 1 ELSE 0 END
    WHERE conversation_id = NEW.conversation_id;
  UPDATE users SET unread_count = unread_count + 1
    WHERE id IN (SELECT user_id FROM conversation_reads WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id);
END;

CREATE TRIGGER conversation_inbox_read AFTER UPDATE OF last_message_id ON conversation_reads
WHEN NEW.last_message_id > OLD.last_message_id
BEGIN
  UPDATE conversation_reads SET unread_count = unread_count - (
    SELECT COUNT(*) FROM messages WHERE conversation_id = NEW.conversation_id
      AND sender_id <> NEW.user_id AND id > OLD.last_message_id AND id <= NEW.last_message_id
  ) WHERE user_id = NEW.user_id AND conversation_id = NEW.conversation_id;
  UPDATE users SET unread_count = unread_count - (OLD.unread_count - (
    SELECT unread_count FROM conversation_reads WHERE user_id = NEW.user_id AND conversation_id = NEW.conversation_id
  )) WHERE id = NEW.user_id;
END;

CREATE TRIGGER conversation_inbox_removed AFTER DELETE ON conversation_reads
BEGIN
  UPDATE users SET unread_count = unread_count - OLD.unread_count WHERE id = OLD.user_id;
END;
