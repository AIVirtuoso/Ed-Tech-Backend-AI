'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Conversations', 'language', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'English'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Conversations', 'language');
  }
};
