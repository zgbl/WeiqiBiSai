2024.12.24 22:14, v0.0.3 解决了 start tournament 的时候 player 不能显示的问题，现在可以显示了。保留一个版本。
2024.12.24 22:57 现在可以显示，记录结果 save result 的问题也解决了。update 哪个 v0.03 版本。
2024.12.25.12:30 现在可以显示单循环比赛结束的排名了。v0.04
2024.12.25. 19:40 现在积分循环已经做好了 v0.05

2025.01.01 完成 Mcmahon 比赛的编排，v0.06
2025.01.2 改进了的 Mcmahon 版本。
2025.01.3 昨天的继续改进乱了。恢复了 01/02 的版本重新来。现在增加了 record result 的 rediobox, 和 add player 的表单。现在 WindSurf，好像又要疯。在他发疯前。留个版本。

2025.1.6 4 号的改动全部 revert, 6 号也 revert 了两次。目前版本。总算加上了 Mcmahon 的 inital score.越往后，越不能依赖 AI 的 debug 了。他解决一个问题，产生新的问题的几率大很多。现在暂时保存这个版本。
2025.1.7-1 修复了重复配对的问题。

2025.1.7-2 现在分数得到更新，但是 winner undefined. （而且 toString 也 undefined。）
2025.1.7-3 轮次的积分正确了。排名时积分有问题。
2025.1.7-4 现在积分排名都正确了。 >现在结束比赛的时候，居然前台只是自己在玩，没有调用后台。难怪后台什么动静也没有，并且 Windsurf 一个劲要修改我的后台加上 API.
算了，今天有成功，明天再加这个 API 吧。

2025.1.8 折腾一天，加 EndTournament 后台，被 AI 一通胡搞，折腾出了很多问题，代码更改了 DB Player Rank. 终于这才修复了今天自己的问题。后台 endTournament 还是没有做，这个版本顶多等同与昨天的版本。

2025.1.10 后台 endTournament 已经做好了。

2025.1.14 今天还挺顺利。要修改的几个功能，都顺利改成

1. 单循环不能 start tournament, 添加了方法。成功。
2. 积分循环不能 start tournament, 同样添加了方法，成功。
   3，积分循环 delete round，成功。
   4，积分循环不能显示即时排名。成功。
