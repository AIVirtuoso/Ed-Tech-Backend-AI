module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ConversationLogs', 'liked', {
      type: Sequelize.BOOLEAN,
      allowNull: true // can be null, true for like, and false for dislike
    });
    await queryInterface.addColumn('ConversationLogs', 'disliked', {
      type: Sequelize.BOOLEAN,
      allowNull: true // can be null, true for like, and false for dislike
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('ConversationLogs', 'liked');
    await queryInterface.removeColumn('ConversationLogs', 'disliked');
  }
};
