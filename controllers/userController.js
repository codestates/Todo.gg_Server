const { user } = require("../models");
// const sequelize = require("sequelize");
const jwt = require('jsonwebtoken');

module.exports = {
  login : async (req,res) =>{
    const body=req.body;
    let userInfo = await user.findOne({
      where: { 
        email: body.email,
        password: body.password 
      }
    });
    if(!userInfo){
      res.status(400).send({data:null,message:'login failed'});
    }else{
      //JWT(access, refresh)토큰 생성후 응답
      const accesstoken=jwt.sign({
        email:userInfo.email,
        profile:userInfo.profile,
        username:userInfo.username,
        createdAt:userInfo.createdAt,
        updatedAt:userInfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
      },process.env.ACCESS_SECRET);
  
      const refreshtoken=jwt.sign({
        email:userInfo.email,
        profile:userInfo.profile,
        username:userInfo.username,
        createdAt:userInfo.createdAt,
        updatedAt:userInfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24*30)
      },process.env.REFRESH_SECRET);
  
      res.cookie('refreshToken', refreshtoken, {
        secure: true,
        httpOnly: true,
        sameSite:'none',
      });
      res.status(200).send({
        userinfo:{
          email:userInfo.email,
          username:userInfo.username
        },
        accessToken:accesstoken, 
        message:'login success'
      });
    }
  },
  
  SignUp : async (req, res) => {
		const body = req.body;
		if (!body.email || !body.password || !body.username) {
			res.status(422).send("insufficient parameters supplied");
		} else if (body.password.length < 6 || body.password.length > 12) {
			res.status(400).send("resize password length");
		} else {
			const createuserinfo = await user.create({
        profile:body.profile,
				email: body.email,
				password: body.password,
				username: body.username,
			}).catch(err=>console.log(err));
			if (createuserinfo) {
				res.status(200).json(createuserinfo);
			}
		}
	},
	CheckEmail: async (req, res) => {
		const body = req.body;
		const email = await user.findOne({
			where: {
				email: body.email,
			},
		}).catch(err=>console.log(err));
		if (email) {
			res.status(400).send({message : "invaild"});
		} else {
			res.status(200).send({message : "vaild" });
		}
	},
	CheckUsername: async (req, res) => {
		const body = req.body;
		const username = await user.findOne({
			where: {
				username: body.username,
			},
		}).catch(err=>console.log(err));
		if (username) {
			res.status(400).send({message:"invalid"});
		} else {
			res.status(200).send({message:"valid"});
		}
  },
  
  DeleteUser : async (req, res) => {
    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    let userInfo;

    //1. 엑세스토큰이 유효한지 확인
    try{
      userInfo=jwt.verify(accessToken, process.env.ACCESS_SECRET);
    }catch(err){
      console.log(err);
    }

    //1-1. 엑세스 토큰이 만료되었을 때
    if(!userInfo){
      const cookieToken=req.cookies.refreshToken;
      console.log('cookietoken:'+cookieToken)
      if(!cookieToken){
        return res.json({data: null, message: 'refresh token not provided'})
      }
      //2. refresh token이 유효한지, 서버가 가지고 있는 비밀 키로 생성한 것이 맞는지 확인합니다.
      let verifyToken = (token) => {
        if(!token){
          return null;
        }
        try{
          return jwt.verify(token, process.env.REFRESH_SECRET);
        }catch(err){
          return null;
        }
      }
      userInfo=verifyToken(cookieToken);
    }
    //엑세스 토큰 재발급
    const accesstoken = jwt.sign({
      email:userInfo.email,
      profile:userInfo.profile,
      username:userInfo.username,
      createdAt:userInfo.createdAt,
      updatedAt:userInfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
    },process.env.ACCESS_SECRET);

    //3. DB 조작
    const deleteUserInfo = await user.destroy({
      where : {
        username : userInfo.username
      }
    }).catch(err => {console.log(err)})

    //4. 응답
    if(!deleteUserInfo){
      res.status(404).send({message : "Not Delete"})
    } else {
      res.status(200).send({data: {accesstoken: accesstoken}, message: 'ok' })
    }
  },
  
  logout : async (req, res) => {
    res.clearCookie("refreshToken").send({message:"clear cookie"})
  }
}