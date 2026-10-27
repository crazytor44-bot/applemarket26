#!/usr/bin/env python3
"""Create a Telethon StringSession locally. Never paste the result into chat."""
import asyncio, getpass
from telethon import TelegramClient
from telethon.sessions import StringSession

async def main():
    api_id = int(input("Telegram API ID: ").strip())
    api_hash = getpass.getpass("Telegram API hash: ").strip()
    phone = input("Номер Telegram в международном формате: ").strip()
    async with TelegramClient(StringSession(), api_id, api_hash) as client:
        await client.start(phone=phone)
        print("\nTELEGRAM_SESSION (сохраните как секрет GitHub, никому не отправляйте):")
        print(client.session.save())

if __name__ == "__main__": asyncio.run(main())
