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
  }
});

ChatLog.belongsTo(Conversation, {
  foreignKey: 'conversationId',
  allowNull: false
});

Conversation.hasMany(ChatLog, {
  foreignKey: 'conversationId'
});

const syncChatsTable = async () => {
  await ChatLog.sync({ force: true });
  console.log('Chatlog table was just synchronized!');
};

// syncChatsTable();

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

export default ChatLog;
