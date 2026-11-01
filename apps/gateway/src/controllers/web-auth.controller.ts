import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { revokeAllSessions } from '@wadatrip/common/sessions';
import { requireWebRequest } from '@wadatrip/common/web-security';
import { AuthController } from './auth.controller';
import { bootstrapWeb,cancelBootstrap,completeWebAuth,logoutWeb,prepareWebAuth } from '../services/web-auth.service';

@Controller('auth/web')
export class WebAuthController {
  private readonly native=new AuthController();
  @Post('bootstrap')
  async bootstrap(@Req() req:any,@Res({passthrough:true}) res:any,@Body() body:any){return bootstrapWeb(getPrisma(),req,res,body?.bootstrap_nonce);}
  @Post('cancel-bootstrap')
  async cancel(@Req() req:any,@Res({passthrough:true}) res:any,@Body() body:any){return cancelBootstrap(getPrisma(),req,res,body?.bootstrap_nonce);}
  private async authenticate(method:'login'|'register'|'verifyCode'|'google'|'firebase',req:any,res:any,body:any){
    await prepareWebAuth(getPrisma(),req);const result=await this.native[method](body,req);completeWebAuth(req,res);return result;
  }
  @Post('login') async login(@Req() req:any,@Res({passthrough:true}) res:any,@Body() body:any){return this.authenticate('login',req,res,body);}
  @Post('request-code') async requestCode(@Req() req:any,@Body() body:any){await prepareWebAuth(getPrisma(),req);return this.native.requestCode(body,req);}
  @Post('register') async register(@Req() req:any,@Res({passthrough:true}) res:any,@Body() body:any){return this.authenticate('register',req,res,body);}
  @Post('verify-code') async verify(@Req() req:any,@Res({passthrough:true}) res:any,@Body() body:any){return this.authenticate('verifyCode',req,res,body);}
  @Post('google') async google(@Req() req:any,@Res({passthrough:true}) res:any,@Body() body:any){return this.authenticate('google',req,res,body);}
  @Post('firebase') async firebase(@Req() req:any,@Res({passthrough:true}) res:any,@Body() body:any){return this.authenticate('firebase',req,res,body);}
  @Post('logout') async logout(@Req() req:any,@Res({passthrough:true}) res:any){return logoutWeb(getPrisma(),req,res);}
  @Post('logout-all') async logoutAll(@Req() req:any,@Res({passthrough:true}) res:any){requireWebRequest(req,true);res.setHeader('Cache-Control','no-store');return revokeAllSessions(getPrisma(),req);}
}
