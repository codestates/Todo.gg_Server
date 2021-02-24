'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class project extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      project.belongsTo(models.user, { foreignKey: "manager_id", targetKey: 'id'});
      project.hasMany(models.taskCard, {foreignKey:"project_id", sourceKey:"id"});
      project.hasMany(models.contributer, {foreignKey:"project_id", sourceKey:"id"});
    }
  };
  project.init({
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    manager_id: DataTypes.INTEGER,
    start_date: DataTypes.DATE,
    end_date: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'project',
  });
  return project;
};