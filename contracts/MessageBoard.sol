// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title 去中心化留言板
/// @notice 用户可在链上发布留言，留言一旦上链永久保存、不可篡改
contract MessageBoard {
    struct Message {
        address author;      // 留言者地址
        string content;      // 留言内容
        uint256 timestamp;   // 留言时间戳
    }

    // 所有留言数组
    Message[] private messages;

    // 每个用户已发布的留言数量（可用于按用户统计）
    mapping(address => uint256) public messageCountOf;

    // 总留言数
    uint256 public totalMessages;

    // 留言发布事件
    event MessagePosted(address indexed author, string content, uint256 timestamp, uint256 index);

    /// @notice 发布一条留言
    /// @param _content 留言内容（不能为空）
    function postMessage(string calldata _content) external {
        require(bytes(_content).length > 0, "Content cannot be empty");
        require(bytes(_content).length <= 280, "Content too long (max 280)");

        uint256 index = messages.length;
        messages.push(
            Message({
                author: msg.sender,
                content: _content,
                timestamp: block.timestamp
            })
        );

        messageCountOf[msg.sender] += 1;
        totalMessages += 1;

        emit MessagePosted(msg.sender, _content, block.timestamp, index);
    }

    /// @notice 获取全部留言
    function getAllMessages() external view returns (Message[] memory) {
        return messages;
    }

    /// @notice 按索引获取单条留言
    function getMessage(uint256 _index) external view returns (address author, string memory content, uint256 timestamp) {
        require(_index < messages.length, "Index out of bounds");
        Message memory m = messages[_index];
        return (m.author, m.content, m.timestamp);
    }

    /// @notice 获取留言总数
    function getCount() external view returns (uint256) {
        return messages.length;
    }
}
