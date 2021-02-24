'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class user extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      user.hasMany(models.project, {foreignKey: "manager_id", sourceKey: "id"});
      user.hasMany(models.contributer, {foreignKey:"user_id", sourceKey:"id"});
    }
  };
  user.init({
    profile:DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    username: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'user',
  });
  return user;
};