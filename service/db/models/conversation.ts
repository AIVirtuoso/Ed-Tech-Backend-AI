const { DataTypes } = require('sequelize');
import sequelize from '../../sequelize';
import Log from './conversationLog';

const Conversation = sequelize.define(
  'Conversations',
  {
    id: {
      primaryKey: true,
      allowNull: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true
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
  },
  {
    timestamps: true,
    paranoid: true
  }
);

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

export const getChatConversationId = async (
  {
    referenceId,
    reference
  }: {
    referenceId: string;
    reference: string;
  },
  createNew = true
) => {
  let convoId = await Conversation.findOne({
    where: {
      referenceId,
      reference
    }
  });

  if (!convoId && createNew) {
    console.log('created a new link');
    convoId = await Conversation.create({ reference, referenceId });
  }

  return convoId.id;
};

export const createNewConversation = async ({
  referenceId,
  reference,
  title
}: {
  reference: string;
  referenceId: string;
  title?: string;
}) => {
  const newChat = await Conversation.create({ reference, referenceId, title });
  return newChat;
};

/**
 * Check if a chat has a title.
 *
 * @param {string} conversationId - The UUID of the conversation.
 * @returns {Promise<boolean>} - True if the chat has a title, otherwise false.
 */
export const chatHasTitle = async (
  conversationId: string
): Promise<boolean> => {
  const chat = await Conversation.findByPk(conversationId);
  return !!chat && !!chat.title;
};

/**
 * Store a title for a chat.
 *
 * @param {string} conversationId - The UUID of the conversation.
 * @param {string} title - The title to store for the chat.
 * @returns {Promise<Conversation>} - The updated chat instance.
 */
export const storeChatTitle = async (
  conversationId: string,
  title: string
): Promise<typeof Conversation> => {
  const chat = await Conversation.findByPk(conversationId);
  if (!chat) {
    throw new Error('Chat not found');
  }

  chat.title = title;
  await chat.save();

  return chat;
};

/**
 * Delete a specific conversation by its UUID.
 *
 * @param {string} conversationId - The UUID of the conversation to be deleted.
 * @returns {Promise<void>} - A promise that resolves when the deletion is complete.
 */
export const deleteConversation = async (
  conversationId: string
): Promise<void> => {
  const result = await Conversation.destroy({
    where: {
      id: conversationId
    }
  });

  if (result === 0) {
    throw new Error('Conversation not found and could not be deleted');
  }
};

export default Conversation;
