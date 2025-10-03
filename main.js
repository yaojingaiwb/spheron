import { ethers } from 'ethers';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import crypto from 'crypto';
import fs from 'fs';

let USERNAME = 'E7A88D6D72C29DE7'
let PASSWORD = 'qqqq1111'

// 签名消息
const MESSAGE_TO_SIGN = "You agree to the reward drop terms and conditions outlined here: https://docs.google.com/document/d/1TITK_eMa_9gIql2d0r1TUS-33vSl48brNaS7oHpmzHQ/edit?usp=sharing";

// 生成动态代理配置
function generateProxyConfig() {
    const s = crypto.randomBytes(10).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
    const username = USERNAME + '-residential-country_ANY-r_10m-s_' + s;
    const password = PASSWORD;
    const host = 'gate.nstproxy.io';
    const port = '24125';
    const proxyUrl = `http://${username}:${password}@${host}:${port}`;
    
    return {
        proxyUrl,
        username,
        password,
        host,
        port
    };
}

// 获取空投详情，带重试
async function getAirdropDetails(address, privateKey, proxyConfig, maxRetries = 5) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const wallet = new ethers.Wallet(privateKey);
            const signature = await wallet.signMessage(MESSAGE_TO_SIGN);
            const proxyAgent = new HttpsProxyAgent(proxyConfig.proxyUrl);
            const response = await axios.post('https://claim.spheron.network/api/get-airdrop-details', {
                address: address,
                signature: signature
            }, {
                headers: {
                    'accept': '*/*',
                    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,ru;q=0.7',
                    'cache-control': 'max-age=0',
                    'content-type': 'application/json',
                    'priority': 'u=1, i',
                    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin'
                },
                httpsAgent: proxyAgent,
                timeout: 30000
            });
            return response.data;
        } catch (error) {
            attempt++;
            if (attempt >= maxRetries) {
                console.error(`获取地址 ${address} 的空投详情失败，错误信息: ${error.message}，已重试 ${maxRetries} 次`);
                return null;
            } else {
                console.warn(`第 ${attempt} 次尝试失败，错误信息: ${error.message}，地址: ${address}，正在重试...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    return null;
}

// 主函数
async function main() {
    try {
        // 读取私钥文件
        const keysContent = fs.readFileSync('keys.txt', 'utf8');
        const privateKeys = keysContent.split('\n').filter(key => key.trim() !== '');
        
        console.log(`找到 ${privateKeys.length} 个私钥需要处理`);
        console.log('='.repeat(80));
        
        const results = [];
        let totalSponVestedAmount = 0;
        let totalClaimedShares = 0;
        let totalRemainingShares = 0;
        
        for (let i = 0; i < privateKeys.length; i++) {
            const privateKey = privateKeys[i].trim();
            
            try {
                // 创建钱包实例
                const wallet = new ethers.Wallet(privateKey);
                const address = wallet.address;
                
                console.log(`正在处理 ${i + 1}/${privateKeys.length}: ${address}`);
                
                // 生成新的代理配置
                const proxyConfig = generateProxyConfig();
                console.log(`使用代理: ${proxyConfig.proxyUrl}`);
                
                // 获取空投详情，带重试
                const airdropInfo = await getAirdropDetails(address, privateKey, proxyConfig, 5);
                
                if (airdropInfo && airdropInfo.success) {
                    const sponVestedAmount = parseFloat(airdropInfo.airdropInfo.sponVestedAmount);
                    const claimedShares = parseFloat(airdropInfo.airdropInfo.vestedInfo.claimedShares) / Math.pow(10, 18);
                    const claimableShares = parseFloat(airdropInfo.airdropInfo.vestedInfo.claimableShares) / Math.pow(10, 18);
                    totalSponVestedAmount += sponVestedAmount;
                    totalClaimedShares += claimedShares;
                    totalRemainingShares += claimableShares;
                    
                    const result = `${privateKey}---${address}---${claimableShares}---${claimedShares}---${sponVestedAmount}`;
                    results.push(result);
                    
                    console.log(`✓ ${address}: 可认领 ${claimableShares} SPON, 总量 ${sponVestedAmount} SPON`);
                } else {
                    console.log(`✗ ${address}: 获取空投信息失败`);
                }
                
                // 添加延迟避免请求过快
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`处理第 ${i + 1} 个私钥时出错:`, error.message);
            }
        }
        
        // 输出结果
        console.log('\n' + '='.repeat(80));
        console.log('最终结果:');
        console.log('='.repeat(80));
        
        results.forEach(result => {
            console.log(result);
        });
        
        // 输出总量统计
        console.log('\n' + '='.repeat(80));
        console.log('总量统计:');
        console.log('='.repeat(80));
        console.log(`总可认领份额(claimableShares)：${totalRemainingShares}`);
        console.log(`总已认领份额(claimedShares)：${totalClaimedShares}`);
        console.log(`总份额(sponVestedAmount)：${totalSponVestedAmount}`);
        
        // 保存到文件
        fs.writeFileSync('results.txt', results.join('\n'), 'utf8');
        console.log(`\n结果已保存到 results.txt`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// 运行主函数
main().catch(console.error); 