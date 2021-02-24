require('dotenv').config();
const  SHA256  = require("./SHA256")
const { user, project, contributer, taskCard } = require("../models");
const Sequelize = require("sequelize");
const jwt = require('jsonwebtoken');
const Op = Sequelize.Op;
const Git_clientID = process.env.GITHUB_CLIENT_ID;
const Git_clientSecret = process.env.GITHUB_CLIENT_SECRET;
const axios = require('axios');



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
        id:userInfo.id,
        email:userInfo.email,
        profile:userInfo.profile,
        username:userInfo.username,
        createdAt:userInfo.createdAt,
        updatedAt:userInfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
      },process.env.ACCESS_SECRET);
  
      const refreshtoken=jwt.sign({
        id:userInfo.id,
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
          id:userInfo.id,
          profile:userInfo.profile,
          email:userInfo.email,
          username:userInfo.username
        },
        accessToken:accesstoken, 
        message:'login success'
      });
    }
  },

  getProjectList: async (req, res) => {
    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    
    //1. 엑세스토큰이 유효한지 확인
    let userInfo;
    let verifyAccessToken = () => {
      if(!accessToken){
        return null;
      }
      try{
        return jwt.verify(accessToken, process.env.ACCESS_SECRET);
      }catch(err){
        return null;
      }
    }
    
    userInfo=verifyAccessToken();

    //1-1. 엑세스 토큰이 만료되었을 때
    if(!userInfo){
      const cookieToken=req.cookies.refreshToken;
      if(!cookieToken){
        return res.status(400).json({data: null, message: 'refresh token not provided'})
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
      const newAccessToken=jwt.sign({
        id:userInfo.id,
        username:userInfo.username,
        profile:userInfo.profile,
        email:userInfo.email,
        createdAt:userInfo.createdAt,
        updatedAt:userInfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60 * 24)
      },process.env.ACCESS_SECRET);
      userInfo.newAccessToken=newAccessToken;
      if(!userInfo){
        return res.status(400).send({message:"invalid refreshToken"});
      }
    }

    const {id} = userInfo;
  
    //3. DB 조작
    await user.findOne({
      where:{
        email:userInfo.email
      },
      attributes:["id","username","email","profile"],
      include: [
        {
          model: contributer,
          attributes:["project_id","user_id"],
          where: {
            project_id: {
              [Op.ne]: null
            }
          },
          include:[
            {
              model:project,
              attributes:["id","title","description","manager_id","start_date","end_date"],
              include:[
                {
                  model:taskCard,
                  attributes:["id","project_id","content","state"],
                  // include:[
                  //   {
                  //     model:contributer,
                  //     attributes:["project_id","user_id"],
                  //     include:[{
                  //       model:user,
                  //       attributes:["profile","username"],
                  //     }]
                  //   }
                  // ]
                },
                {
                  model:contributer,
                  attributes:["project_id","user_id"],
                  include:[{
                    model:user,
                    attributes:["id","profile","username"],
                  }]
                },
                {
                  model:user,
                  attributes:["profile"]
                }
              ]
            }
          ]
        },
      ]
    })
    .then((data)=>{
      if(!data){
        return res.send({projectList:{id:'',username:'',email:'',profile:'',contributers:[],taskCardCount:[]}})
      }
      delete data.dataValues.password;
      let taskCardsArr=[];

      data.contributers.map(ele=>{
        if(ele.project){          
          let countObj={todo:0,inprogress:0,done:0};
          countObj.project_id=ele.project_id;
  
          for(let i=0;i<ele.project.taskCards.length;i++){
            if(ele.project.taskCards[i].dataValues.state=="todo"){
              if(countObj.todo<1){
                countObj.todo=1;
              }else{ 
                countObj.todo++;
              }
            }
            if(ele.project.taskCards[i].dataValues.state=="inprogress"){
              if(countObj.inprogress<1){
                countObj.inprogress=1;
              }else{
                countObj.inprogress++;
              }
            }
            if(ele.project.taskCards[i].dataValues.state=="done"){
              if(countObj.done<1){
                countObj.done=1;
              }else{
                countObj.done++;
              }
            }
          }
          taskCardsArr.push(countObj);
        }
      })
      data.dataValues.taskCardCount=taskCardsArr;
      if(userInfo.newAccessToken){
        res.status(200).send({projectList:data, accessToken: userInfo.newAccessToken});
      }else{
        res.status(200).send({projectList:data});
      }

    })
    .catch((err)=>console.log(err));
  },
  
  SignUp : async (req, res) => {
    const body = req.body;
    await user.create({
      profile:body.profile,
      email: body.email,
      password: body.password,
      username: body.username,
    }).catch(err=>res.status(400).send(err));
    res.status(200).json({message:"signup success"});
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
	GitHub_SocialLogin : (req, res) => {
    axios({
      method: 'post',
      url: `https://github.com/login/oauth/access_token`,
      headers: {
        accept: 'application/json',
      },
      data: {
        client_id: Git_clientID,
        client_secret: Git_clientSecret,
        code: req.body.authorizationCode
      }
    }).then((response) => {
      accessToken = response.data.access_token;
      res.status(200).json({ accessToken: accessToken })
  
    }).catch(e => {
      res.status(404).send({message:"not access"})
    })    
  },

  GitHub_SignUpNLogin : async (req,res) => {
    const body = req.body.data;
    let userinfo;
    const gitName = body.name ? body.name : "GithubName"+body.id;
    // const userinfo = await user.findOrCreate({
    //   where : {
    //     email : body.id,
    //   },
    //   default : {
    //     email : body.id,
    //     username : gitName,
    //     password : body.login,
    //     profile : body.avatar_url
    //   }
    // })
    let findUser = await user.findOne({
      where:{
        email:body.id
      }
    })

    if(findUser){
      userinfo=findUser;
    }else{ //새로가입해야함
      userinfo=await user.create({
        email : body.id,
        username : gitName,
        password : SHA256(body.login),
        profile : body.avatar_url        
      })
    }
    console.log(body.login)

    const accesstoken=jwt.sign({
      id:userinfo.id,
      email:userinfo.email,
      profile:userinfo.profile,
      username:userinfo.username,
      createdAt:userinfo.createdAt,
      updatedAt:userinfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
    },process.env.ACCESS_SECRET);

    const refreshtoken=jwt.sign({
      id:userinfo.id,
      email:userinfo.email,
      profile:userinfo.profile,
      username:userinfo.username,
      createdAt:userinfo.createdAt,
      updatedAt:userinfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24*30)
    },process.env.REFRESH_SECRET);

    res.cookie('refreshToken', refreshtoken, {
      secure: true,
      httpOnly: true,
      sameSite:'none',
    });

    if(!userinfo){
      res.status(400).send({message:"signUp or login failed"})
    } else {
      res.status(200).send({userinfo:userinfo, accessToken:accesstoken , message:"github login success"})
    }
  },

  GoogleLogin : async (req,res) => {
     let userinfo
     const body = req.body
     let findUser = await user.findOne({
       where:{
         email:body.email
       }
     })

     if(findUser){
       userinfo=findUser;
     }else{ //새로가입해야함
       userinfo=await user.create({
         username : body.username,
         email : body.email,
         profile : body.profile,
         password : SHA256(body.password)       
       })
     }

    const accesstoken=jwt.sign({
      id:userinfo.id,
      email:userinfo.email,
      profile:userinfo.profile,
      username:userinfo.username,
      createdAt:userinfo.createdAt,
      updatedAt:userinfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
    },process.env.ACCESS_SECRET);

    const refreshtoken=jwt.sign({
      id:userinfo.id,
      email:userinfo.email,
      profile:userinfo.profile,
      username:userinfo.username,
      createdAt:userinfo.createdAt,
      updatedAt:userinfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24*30)
    },process.env.REFRESH_SECRET);

    res.cookie('refreshToken', refreshtoken, {
      secure: true,
      httpOnly: true,
      sameSite:'none',
    });

    if(!userinfo){
      res.status(400).send({message : "cant login"})
    } else {
      res.status(200).send({userinfo:userinfo, accessToken:accesstoken , message:"google login success"})
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
      res.status(200).send({message : "Good!"})
    }
  },
  
  logout : async (req, res) => {
    res.clearCookie("refreshToken").send({message:"clear cookie"})
  },
  
  GetUserInfo : async (req, res) => {
    const body = req.body
    const UserInfo = await user.findOne({
      where : {
        username : body.username
      }
    }).catch(err => {console.log(err)})
    if(!UserInfo){
      res.status(404).send({message:"user doesn't exists"})
    } else {
      res.status(200).json({user:{id:UserInfo.id, email:UserInfo.email, username:UserInfo.username, profile:UserInfo.profile}})
    }
  },

  updateUserinfo : async (req, res) => {

    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    let userInfo;

    //1. 엑세스토큰이 유효한지 확인
    const actokenverify = () => {
    try{
      return jwt.verify(accessToken, process.env.ACCESS_SECRET);
    }catch(err){
      console.log(err);
      return null
    }
  }

  userInfo=actokenverify();

    // 1-1. 엑세스 토큰이 만료되었을 때
    if(!userInfo){
      const cookieToken=req.cookies.refreshToken;
      // console.log('cookietoken:'+cookieToken)
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
      userInfo.refreshToken = true
      if(!userInfo){
        return res.json({message:"refresh token invaild"})
      }
      
    }

    const body = req.body
    
      const result = await user.update({
        profile : body.profile,
        username : body.username,
        password : body.password
      },
      {
        where : {
        email:userInfo.email
      }
    }).catch(err => {console.log(err)})
      const userinfo = await user.findOne({
        where : {
          email : userInfo.email
        }
      }).catch(err=>{console.log(err)})

      //항상 엑세스 토큰 새로 발급
      const accesstoken=jwt.sign({
        id:userInfo.id,
        email:userinfo.email,
        profile:userinfo.profile,
        username:userinfo.username,
        createdAt:userinfo.createdAt,
        updatedAt:userinfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
      },process.env.ACCESS_SECRET);
      userinfo.accessToken = accesstoken

      if(result[0]!==1){
        res.status(400).send({message:"update failed"})
      } else {
        res.status(200).send({message:"userinfo updated",username:userinfo.username,profile:userinfo.profile,accessToken:userinfo.accessToken})
      }
  },
  
  checkPassWord : async (req, res) => {
    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    let userInfo;
    //1. 엑세스토큰이 유효한지 확인
    const actokenverify = () => {
    try{
      return jwt.verify(accessToken, process.env.ACCESS_SECRET);
    }catch(err){
      console.log(err);
      return null
    }
  }
  userInfo=actokenverify();
  // 1-1. 엑세스 토큰이 만료되었을 때
  if(!userInfo){
    const cookieToken=req.cookies.refreshToken;
    // console.log('cookietoken:'+cookieToken)
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
    userInfo.refreshToken = true
    if(!userInfo){
      return res.json({message:"refresh token invaild"})
    }
  }
  const body = req.body
    const check = await user.findOne({
      where : {
        username : userInfo.username
      }
    }).catch(err=>{console.log(err)})
    if(userInfo.refreshToken){
      const accesstoken=jwt.sign({
        id:userInfo.id,
        email:check.email,
        profile:check.profile,
        username:check.username,
        createdAt:check.createdAt,
        updatedAt:check.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
      },process.env.ACCESS_SECRET);
      check.accessToken = accesstoken
    } else {
      if(body.password===check.password){
        res.status(200).json({accessToken:check.accesstoken,message:"valid"})
      } else {
        res.status(422).send({message:"invalid"})
      }
    }
  }
}