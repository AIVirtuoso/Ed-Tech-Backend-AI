module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ConversationLogs', 'isPinned', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ConversationLogs', 'isPinned');
  }
};
