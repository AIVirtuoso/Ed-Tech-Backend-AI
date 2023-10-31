// migrations/xxxx-xx-xx-add-title-and-soft-delete-to-conversations.js
'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('Conversations', 'deletedAt', {
            type: Sequelize.DATE,
            allowNull: true
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Conversations', 'deletedAt');
    }
};
