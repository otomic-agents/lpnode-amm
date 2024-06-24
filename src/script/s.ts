import nacl from "tweetnacl";
import bs58 from 'bs58'; // 引入bs58库
const signatureData = {
  type: "Buffer",
  data: [
    178, 95, 34, 215, 132, 250, 81, 11, 116, 235, 96, 240, 195, 35, 60, 57, 156,
    43, 149, 42, 158, 141, 84, 196, 111, 202, 72, 8, 140, 27, 74, 219, 116, 251,
    198, 205, 132, 5, 219, 110, 249, 214, 142, 129, 197, 55, 148, 78, 255, 97,
    4, 20, 98, 193, 243, 25, 2, 84, 187, 73, 61, 216, 227, 2,
  ],
};
const publicKeyStr = "AEycfuMAiatT2EEn3RvBiuWVebJ23b1wstaKmTdZxXBm";

const signature = new Uint8Array(signatureData.data);

// 将publicKeyStr从Base58解码为Uint8Array
const publicKey = bs58.decode(publicKeyStr);

// 现在我们可以使用这些变量来验证签名
const message = new TextEncoder().encode("LINING");

const isValid = nacl.sign.detached.verify(message, signature, publicKey);

if (isValid) {
  console.log("Signature is valid.");
} else {
  console.log("Signature is not valid.");
}
