const { DataTypes } = require('sequelize');
import sequelize from '../../sequelize';
import Document from './document';

interface Highlight {
  highlight: JSON;
  documentId: string;
}

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
export const getHighlights = async (documentId: string): Promise<Highlight> => {
  const highlight = await Highlight.findAll({
    where: {
      documentId
    },
    order: [['createdAt']]
  });
  return highlight || [];
};

export const createOrUpdateHighlight = async (data: Highlight) => {
  const createdHighlight = await Highlight.upsert(data);

  return createdHighlight[0]?.dataValues || [];
};

export default Highlight;
