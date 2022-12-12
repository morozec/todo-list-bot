const { Telegraf, Markup } = require('telegraf');
const { Pool, Client } = require('pg')


const util = require('util');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);
let client = undefined;

const MODE = {
    DEFAULT: 'DEFAULT',
    SET_GROUP: 'SET_GROUP',
    ADD_TASK: 'ADD_TASK',
};
let mode = MODE.DEFAULT;
let groupName = null;

const setDefaultState = () => {
    mode = MODE.DEFAULT;
    groupName = null;
}

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
    /add <текст задачи> - добавить новую задачу в группу по умолчанию. Например: "/add Сходить за хлебом"
    /add_grouped - добавить новую задачу, указав в последующем диалоге группу и текст задачи
    /show - показать список запланированных задач из группы по умолчанию
    /show <имя группы> - показать список запланированных задач из заданной группы. Например, "/show Работа"
    /show_done - показать список выполненных задач
    /clear - очистить список запланированных задач
    /clear_done - очистить список выполненных задач
    `))

const separateArgument = (commandLine) => {
    const index = commandLine.indexOf(' ');
    if (index === -1) {
        return '';
    }
    return commandLine.substring(index + 1);
}

bot.command('show', (ctx) => {
    setDefaultState();
    const groupNameToShow = separateArgument(ctx.message.text);

    const text = groupNameToShow === ''
        ? 'SELECT * from TODO where Done=FALSE and account_name=$1 and groupName is NULL;'
        : 'SELECT * from TODO where Done=FALSE and account_name=$1 and groupName=$2;';
    const values = groupNameToShow === ''
        ? [ctx.message.from.username]
        : [ctx.message.from.username, groupNameToShow];
    client.query(text, values)
        .then(res => {
            if (res.rows.length === 0) {
                return ctx.reply('У вас пока нет задач. Добавьте задачу командой /add или /add_grouped');
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
    setDefaultState();
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

bot.command('add', (ctx) => {
    setDefaultState();
    const todoValue = separateArgument(ctx.message.text);
    if (todoValue) {
        const text = 'INSERT INTO todo (value, done, account_name) VALUES ($1, FALSE, $2);';
        const values = [todoValue, ctx.message.from.username];
        client.query(text, values)
            .then(res => {
                ctx.reply(`Задача "${todoValue}" добавлена`);
            });
    } else {
        ctx.reply('Введите текст задачи:');
        mode = MODE.ADD_TASK;
    }
});

bot.command('add_grouped', (ctx) => {
    setDefaultState();
    const todoValue = separateArgument(ctx.message.text);
    if (todoValue) {
        const text = 'INSERT INTO todo (value, done, account_name) VALUES ($1, FALSE, $2);';
        const values = [todoValue, ctx.message.from.username];
        client.query(text, values)
            .then(res => {
                ctx.reply(`Задача "${todoValue}" добавлена`);
            });
    } else {
        ctx.reply('Введите группу задачи:');
        mode = MODE.SET_GROUP;
    }
});

bot.command('clear', (ctx) => {
    setDefaultState();
    const text = 'DELETE FROM todo WHERE done=FALSE AND account_name=$1';
    const values = [ctx.message.from.username];
    client.query(text, values)
        .then(res => {
            ctx.reply('Список задач очищен');
        });
});

bot.command('clear_done', (ctx) => {
    setDefaultState();
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
    if (mode === MODE.DEFAULT) {
        return;
    }
    if (mode === MODE.SET_GROUP) {
        mode = MODE.ADD_TASK;
        groupName = ctx.message.text;
        ctx.reply('Введите текст задачи:');
        return;
    }
    if (mode === MODE.ADD_TASK) {
        const messageText = ctx.message.text;
        if (messageText) {
            const text = 'INSERT INTO todo (value, groupName, done, account_name) VALUES ($1, $2, FALSE, $3);';
            const values = [messageText, groupName, ctx.message.from.username];
            client.query(text, values)
                .then(res => {
                    ctx.reply(`Задача "${messageText}" добавлена в группу "${groupName ? groupName : 'по умолчанию'}"`);
                    setDefaultState();
                });
        } else {
            ctx.reply('Нельзя завести пустую задачу. Пожалуйста, попробуйте снова.');
        }
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
