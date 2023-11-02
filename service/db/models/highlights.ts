const { DataTypes } = require('sequelize');
import HighlightComment, { HighlightCommentType } from './highlightComment';
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

Highlight.hasMany(HighlightComment, {
  foreignKey: 'highlightId',
  as: 'comments'
});

HighlightComment.belongsTo(Highlight, {
  foreignKey: 'highlightId'
});

export const getHighlights = async (documentId: string): Promise<Highlight> => {
  const highlight = await Highlight.findAll({
    where: {
      documentId
    },
    include: {
      model: HighlightComment,
      as: 'comments'
    },
    order: [['createdAt']]
  });
  return highlight || [];
};

export const getHighlight = async (highlightId: string): Promise<Highlight> => {
  const highlight = await Highlight.findOne({
    where: {
      id: highlightId
    },
    include: {
      model: HighlightComment,
      as: 'comments'
    }
  });
  return highlight;
};

export const saveHighlightComment = async (
  data: Partial<HighlightCommentType>
) => {
  const comment = await HighlightComment.create(data);
  return comment.dataValues;
};

export const createOrUpdateHighlight = async (data: Highlight) => {
  const createdHighlight = await Highlight.upsert(data);

  return createdHighlight[0]?.dataValues || [];
};

export default Highlight;
