const { DataTypes } = require('sequelize');
import sequelize from '../../sequelize/index';
import Conversation from './conversation';

interface Chat {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatData {
  studentId: string;
  log: Array<Chat>;
  conversationId: string;
}

const ChatLog = sequelize.define('ConversationLog', {
  studentId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  log: {
    type: DataTypes.JSON,
    allowNull: false
  },
  liked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  disliked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

ChatLog.belongsTo(Conversation, {
  foreignKey: 'conversationId',
  allowNull: false
});

Conversation.hasMany(ChatLog, {
  foreignKey: 'conversationId'
});

export const createNewChat = async ({
  studentId,
  log,
  conversationId
}: {
  studentId: string;
  log: Chat;
  conversationId: string;
}) => {
  await ChatLog.create({
    studentId,
    conversationId,
    log: log
  });
};

export const getChatLogs = async ({
  studentId,
  conversationId
}: {
  studentId: string;
  conversationId: string;
}) => {
  const history = await ChatLog.findOne({
    where: {
      studentId,
      conversationId
    }
  }).then((data: ChatData) => {
    if (data?.log) return data.log;
    return [];
  });

  return history;
};

export const fetchAllStudentChats = async ({
  studentId
}: {
  studentId: string;
}) => {
  const allStudentChats = await Conversation.findAll({
    where: {
      referenceId: studentId
    },
    include: [
      {
        model: ChatLog
      }
    ]
  });

  return allStudentChats;
};

export const fetchSpecificStudentChat = async (conversationId: string) => {
  const studentChat = await Conversation.findAll({
    where: {
      id: conversationId
    },
    include: [
      {
        model: ChatLog
      }
    ]
  });

  return studentChat[0]?.ConversationLogs || [];
};

export const toggleLike = async (chatLogId: string) => {
  const chatLog = await ChatLog.findOne({
    where: {
      id: chatLogId
    }
  });

  if (!chatLog) throw new Error('ChatLog not found!');

  // Toggle like
  chatLog.liked = !chatLog.liked;

  // If the chat was liked, we ensure it's not disliked
  if (chatLog.liked) chatLog.disliked = false;

  return await chatLog.save();
};

export const toggleDislike = async (chatLogId: string) => {
  const chatLog = await ChatLog.findOne({
    where: {
      id: chatLogId
    }
  });

  if (!chatLog) throw new Error('ChatLog not found!');

  // Toggle dislike
  chatLog.disliked = !chatLog.disliked;

  // If the chat was disliked, we ensure it's not liked
  if (chatLog.disliked) chatLog.liked = false;

  return await chatLog.save();
};

export const handleReaction = async (
  chatLogId: string,
  reactionType: 'like' | 'dislike'
) => {
  switch (reactionType) {
    case 'like':
      return await toggleLike(chatLogId);
    case 'dislike':
      return await toggleDislike(chatLogId);
    default:
      throw new Error('Invalid reaction type!');
  }
};

export default ChatLog;
