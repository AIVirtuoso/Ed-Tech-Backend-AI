'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Conversations', 'topic', {
        type: Sequelize.DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn('Conversations', 'subject', {
        type: Sequelize.DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn('Conversations', 'level', {
        type: Sequelize.DataTypes.STRING,
        allowNull: true
      })
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('Conversations', 'topic'),
      queryInterface.removeColumn('Conversations', 'subject'),
      queryInterface.removeColumn('Conversations', 'level')
    ]);
  }
};
