'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class contributer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      contributer.belongsTo(models.project, {foreignKey: "project_id", targetKey:"id", onDelete:"cascade"});
      contributer.belongsTo(models.taskCard, {foreignKey:"taskCard_id", targetKey:"id", onDelete:"cascade"});
      contributer.belongsTo(models.user, {foreignKey:"user_id", targetKey:"id"});
    }
  };
  contributer.init({
    project_id: DataTypes.INTEGER,
    taskCard_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'contributer',
  });
  return contributer;
};