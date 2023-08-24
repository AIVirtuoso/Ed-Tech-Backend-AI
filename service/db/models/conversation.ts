const { DataTypes } = require('sequelize');
import sequelize from '../../sequelize';
import Log from './conversationLog';

const Conversation = sequelize.define('Conversations', {
  id: {
    primaryKey: true,
    allowNull: false,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
  },
  reference: {
    type: DataTypes.ENUM('student', 'document'),
    allowNull: false,
    default: 'document'
  },
  referenceId: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const syncConversationTable = async () => {
  // await Conversation.sync();
  console.log('Conversation table was just synchronized!');
};

// syncConversationTable();

export const getChatConversations = async ({
  referenceId,
  reference
}: {
  referenceId: string;
  reference: string;
}) => {
  const chats = await Conversation.findAll({
    where: {
      referenceId,
      reference
    },
    include: [
      {
        model: Log
      }
    ]
  });

  return chats;
};

export const getChatConversationId = async ({
  referenceId,
  reference
}: {
  referenceId: string;
  reference: string;
}) => {
  let convoId = await Conversation.findOne({
    where: {
      referenceId,
      reference
    }
  });

  if (!convoId) {
    convoId = await Conversation.create({ reference, referenceId });
  }

  return convoId.id;
};

export const createNewConversation = async ({
  referenceId,
  reference
}: {
  reference: string;
  referenceId: string;
}) => {
  const newChat = await Conversation.create({ reference, referenceId });
  return newChat;
};

export default Conversation;
