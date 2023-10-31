const { DataTypes } = require('sequelize');
import sequelize from '../../sequelize/index';
import Conversation from './conversation';
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
export const createNewChat = async ({ studentId, log, conversationId }) => {
    await ChatLog.create({
        studentId,
        conversationId,
        log: log
    });
};
export const getChatLogs = async ({ studentId, conversationId }) => {
    const history = await ChatLog.findOne({
        where: {
            studentId,
            conversationId
        }
    }).then((data) => {
        if (data?.log)
            return data.log;
        return [];
    });
    return history;
};
export const fetchAllStudentChats = async ({ studentId }) => {
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
export const fetchSpecificStudentChat = async (conversationId) => {
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
