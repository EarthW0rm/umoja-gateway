import { Injectable } from '@nestjs/common';

@Injectable()
export class UmojaApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
