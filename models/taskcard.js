'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class taskCard extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      taskCard.belongsTo(models.project, {foreignKey:"project_id", targetKey:"id", onDelete:"cascade"});
      taskCard.hasMany(models.contributer, {foreignKey:"taskCard_id", sourceKey:"id"});
    }
  };
  taskCard.init({
    project_id: DataTypes.INTEGER,
    content: DataTypes.STRING,
    state: DataTypes.STRING,
    position: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'taskCard',
  });
  return taskCard;
};