const { DataTypes } = require('sequelize');
import sequelize from '../../sequelize';
const Highlight = sequelize.define('Highlight', {
    id: {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4
    },
    highlight: {
        type: DataTypes.JSONB,
        allowNull: false
    },
    documentId: {
        type: DataTypes.STRING,
        allowNull: false
    }
});
export const getHighlights = async (documentId) => {
    const highlight = await Highlight.findAll({
        where: {
            documentId
        },
        order: [['createdAt']]
    });
    return highlight || [];
};
export const getHighlight = async (highlightId) => {
    const highlight = await Highlight.findOne({
        where: {
            id: highlightId
        }
    });
    return highlight;
};
export const createOrUpdateHighlight = async (data) => {
    const createdHighlight = await Highlight.upsert(data);
    return createdHighlight[0]?.dataValues || [];
};
export default Highlight;
