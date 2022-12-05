const { Telegraf, Markup } = require('telegraf');
const { Pool, Client } = require('pg')


const util = require('util');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);
let client = undefined;
let isAddTaskMode = false;

bot.start((ctx) => {
    client
        .query(`INSERT INTO ACCOUNT (name) VALUES ('${ctx.message.from.username}') ON CONFLICT DO NOTHING`)
        .then(() =>
            ctx.reply(
                `Привет, ${ctx.message.from.username}! Я бот-ежедневник.
Я умею добавлять задачи, отмечать задачи выпоненными, показывать список запланированных и выполненных задач.
С полным списком моих функций можно ознакомиться по команде /help`
            ));
});

bot.help((ctx) => ctx.reply(`Вот что я умею:\n
    /add <текст задачи> - добавить новую задачу. Например: "/add Сходить за хлебом"
    /show - показать список запланированных задач
    /show_done - показать список выполненных задач
    /clear - очистить список запланированных задач
    /clear_done - очистить список выполненных задач
    `))

bot.command('show', (ctx) => {
    isAddTaskMode = false;

    const text = 'SELECT * from TODO where Done=FALSE and account_name=$1;'
    const values = [ctx.message.from.username];
    client.query(text, values)
        .then(res => {
            if (res.rows.length === 0) {
                return ctx.reply('У вас пока нет задач. Добавьте задачу командой /add');
            }
            const buttons = res.rows.map(({id, value}) => [Markup.button.callback(value, id)]);
            return ctx.reply('Список задач. Кликните по задаче, чтобы отметить ее выполненной\n', {
                ...Markup.inlineKeyboard(
                    buttons
                )
            })
        });
});

bot.command('show_done', (ctx) => {
    isAddTaskMode = false;
    let response = 'Список выполненных задач:\n';
    const text = 'SELECT * from TODO where Done=TRUE and account_name=$1;'
    const values = [ctx.message.from.username];
    client.query(text, values)
        .then(res => {
            if (res.rows.length === 0) {
                return ctx.reply('У вас пока нет выполненных задач');
            }
            for (const {value} of res.rows) {
                response += `✓ ${value}\n`;
            }
            ctx.reply(response);
        });
});

const separateTodoValue = (commandLine) => {
    const index = commandLine.indexOf(' ');
    if (index === -1) {
        return '';
    }
    return commandLine.substring(index + 1);
}

bot.command('add', (ctx) => {
    isAddTaskMode = false;
    const todoValue = separateTodoValue(ctx.message.text);
    if (todoValue) {
        const text = 'INSERT INTO todo (value, done, account_name) VALUES ($1, FALSE, $2);';
        const values = [todoValue, ctx.message.from.username];
        client.query(text, values)
            .then(res => {
                ctx.reply(`Задача "${todoValue}" добавлена`);
            });
    } else {
        ctx.reply('Введите текст задачи:');
        isAddTaskMode = true;
    }
});

bot.command('clear', (ctx) => {
    isAddTaskMode = false;
    const text = 'DELETE FROM todo WHERE done=FALSE AND account_name=$1';
    const values = [ctx.message.from.username];
    client.query(text, values)
        .then(res => {
            ctx.reply('Список задач очищен');
        });
});

bot.command('clear_done', (ctx) => {
    isAddTaskMode = false;
    const text = 'DELETE FROM todo WHERE done=TRUE AND account_name=$1';
    const values = [ctx.message.from.username];
    client.query(text, values)
        .then(res => {
            ctx.reply('Список выполненных задач очищен');
        });
});

bot.action(/.+/, ctx => {
    const id = ctx.match[0];
    if (!id) {
        return;
    }
    const text = 'UPDATE Todo SET Done=True WHERE id = $1';
    const values = [id];
    client.query(text, values)
        .then(res => ctx.answerCbQuery(`Задача успешно выполнена`));
});

bot.on('text', (ctx) => {
    if (!isAddTaskMode) {
        return;
    }

    isAddTaskMode = false;
    const messageText = ctx.message.text;
    if (messageText) {
        const text = 'INSERT INTO todo (value, done, account_name) VALUES ($1, FALSE, $2);';
        const values = [messageText, ctx.message.from.username];
        client.query(text, values)
            .then(res => {
                ctx.reply(`Задача "${messageText}" добавлена`);
            });
    } else {
        ctx.reply('Нельзя завести пустую задачу. Пожалуйста, попробуйте снова.');
    }
});



module.exports.handler = async function (event, context) {
    const proxyId = "akffpjo0anaud6asc6iu";// Идентификатор подключения
    let proxyEndpoint = "akffpjo0anaud6asc6iu.postgresql-proxy.serverless.yandexcloud.net:6432"; // Точка входа
    let user = "morozov-andre"; // Пользователь БД
    console.log(context.token);
    let conString = "postgres://" + user + ":" + context.token.access_token + "@" + proxyEndpoint + "/" + proxyId + "?ssl=true";

    client = new Client(conString);
    client.connect();

    const message = JSON.parse(event.body);
    await bot.handleUpdate(message);
    return {
        statusCode: 200,
        body: '',
    };
};
