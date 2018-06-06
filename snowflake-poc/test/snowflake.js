const Web3 = require('web3') // 1.0.0-beta.34
const web3 = new Web3(Web3.givenProvider || 'http://localhost:8555')

const HydroToken = artifacts.require('./_testing/HydroToken.sol')
const ClientRaindrop = artifacts.require('./_testing/ClientRaindrop.sol')
const Snowflake = artifacts.require('./Snowflake.sol')

contract('Clean Room', function (accounts) {
  const owner = {
    public: accounts[0]
  }
  var user = {
    hydroID: 'p4hwf8t',
    public: accounts[1],
    private: '6bf410ff825d07346c110c5836b33ec76e7d1ee051283937392180b732aa3aff',
    names: ['Prefix', 'First', 'Middle', 'Last', 'Suffix', 'Preferred'],
    dateOfBirth: ['30', '7', '2015'],
    emails: { 'Main Email': 'test@test.test' },
    phoneNumbers: { 'Mobile': '1234567890' },
    physicalAddresses: { 'Home': 'P. Sherman, 42 Wallaby Way, Sydney' }
  }
  user.salt = web3.utils.soliditySha3({t: 'bytes32', v: `0x${user.private}`}, {t: 'address', v: user.public})
  const encrypt = (strings, salt) => {
    return strings.map(x => { return web3.utils.soliditySha3({ t: 'string', v: x }, { t: 'bytes32', v: salt }) })
  }
  const hashedNames = encrypt(user.names, user.salt)
  const hashedDateOfBirth = encrypt(user.dateOfBirth, user.salt)
  const hashedEmails = encrypt(Object.values(user.emails), user.salt)
  const hashedPhone = encrypt(Object.values(user.phoneNumbers), user.salt)
  const hashedAddresses = encrypt(Object.values(user.physicalAddresses), user.salt)

  const nameOrder = ['prefix', 'givenName', 'middleName', 'surname', 'suffix', 'preferredName']
  const dateOrder = ['day', 'month', 'year']

  var hydroInstance
  var raindropInstance
  var snowflakeInstance

  describe('Deploy and prepare testing-only contracts', async function () {
    it('hydro token deployed', async function () {
      hydroInstance = await HydroToken.new({from: owner.public})
    })

    it('Client Raindrop deployed', async function () {
      raindropInstance = await ClientRaindrop.new({ from: owner.public })
    })

    it('raindrop linked to token', async function () {
      await raindropInstance.setHydroTokenAddress(hydroInstance.address, {from: owner.public})
      let contractHydroTokenAddress = await raindropInstance.hydroTokenAddress()
      assert.equal(contractHydroTokenAddress, hydroInstance.address, 'address set incorrectly')
    })

    it('Client Raindrop user signed up', async function () {
      await raindropInstance.signUpUser(user.hydroID, {from: user.public})
    })
  })

  describe('Deploy and prepare snowflake', async function () {
    it('snowflake deployed', async function () {
      snowflakeInstance = await Snowflake.new({from: owner.public})
    })

    it('snowflake linked', async function () {
      await snowflakeInstance.setClientRaindropAddress(
        raindropInstance.address
      )
      await snowflakeInstance.setHydroTokenAddress(
        hydroInstance.address
      )
    })
  })

  describe('Test snowflake functionality', function () {
    it('mint identity token', async function () {
      let tokenId = await snowflakeInstance.mintIdentityToken.call(
        hashedNames, hashedDateOfBirth, { from: user.public }
      )
      assert.equal(tokenId, '1')
      await snowflakeInstance.mintIdentityToken(hashedNames, hashedDateOfBirth, { from: user.public })
    })

    it('verify token ownership', async function () {
      let ownerOf = await snowflakeInstance.ownerOf.call(1)
      assert.equal(ownerOf, user.public)
      let tokenofAddress = await snowflakeInstance.tokenOfAddress.call(user.public)
      assert.equal(tokenofAddress, '1')
      let tokenofHydroID = await snowflakeInstance.tokenOfHydroID.call(user.hydroID)
      assert.equal(tokenofHydroID, '1')
    })

    it('verify token details', async function () {
      let tokenDetails = await snowflakeInstance.tokenDetails.call(1)
      assert.equal(tokenDetails[0], user.public)
      assert.equal(tokenDetails[1], user.hydroID)
      assert.deepEqual(tokenDetails[2].map(x => { return x.toNumber() }), [0, 1])
      assert.deepEqual(tokenDetails[3], [])
    })

    it('verify field details', async function () {
      let nameDetails = await snowflakeInstance.fieldDetails.call(1, 0)
      // assert.deepEqual(nameDetails[0], nameOrder)
      assert.deepEqual(nameDetails[1], [])

      let dateDetails = await snowflakeInstance.fieldDetails.call(1, 1)
      // assert.deepEqual(dateDetails[0], dateOrder)
      assert.deepEqual(dateDetails[1], [])
    })

    it('verify entry details', async function () {
      var nameEntryDetails
      for (let i = 0; i < user.names.length; i++) {
        nameEntryDetails = await snowflakeInstance.entryDetails.call(1, 0, nameOrder[i])
        assert.equal(nameEntryDetails[0], hashedNames[i])
        assert.deepEqual(nameEntryDetails[1], [])
      }
      var birthEntryDetails
      for (let i = 0; i < user.dateOfBirth.length; i++) {
        birthEntryDetails = await snowflakeInstance.entryDetails.call(1, 1, dateOrder[i])
        assert.equal(birthEntryDetails[0], hashedDateOfBirth[i])
        assert.deepEqual(birthEntryDetails[1], [])
      }
    })

    // it('add new fields', async function () {
    //   await snowflakeInstance.addUpdateFieldEntries.call(
    //     2, Object.keys(user.emails), hashedEmails, { from: user.public }
    //   )
    //   await snowflakeInstance.addUpdateFieldEntries.call(
    //     3, Object.keys(user.phoneNumbers), hashedPhone, user.salt, { from: user.public }
    //   )
    //   await snowflakeInstance.addUpdateFieldEntries.call(
    //     4, Object.keys(user.physicalAddresses), hashedAddresses, user.salt, { from: user.public }
    //   )
    // })

    // it('verify new token details', async function () {
    //   let tokenDetails = await snowflakeInstance.tokenDetails.call(1)
    //   assert.deepEqual(tokenDetails[2].map(x => { return x.toNumber() }), [0, 1, 2, 3, 4])
    // })

    // it('verify new field details', async function () {
    //   let emailDetails = await snowflakeInstance.fieldDetails.call(1, 2)
    //   // assert.deepEqual(emailDetails[0], Object.keys(user.emails))
    //   assert.deepEqual(emailDetails[1], [])

    //   let phoneDetails = await snowflakeInstance.fieldDetails.call(1, 3)
    //   // assert.deepEqual(phoneDetails[0], Object.keys(user.phoneNumbers))
    //   assert.deepEqual(phoneDetails[1], [])

    //   let addressDetails = await snowflakeInstance.fieldDetails.call(1, 4)
    //   // assert.deepEqual(addressDetails[0], Object.keys(user.physicalAddresses))
    //   assert.deepEqual(addressDetails[1], [])
    // })

    // it('verify new entry details', async function () {
    //   var emailEntryDetails
    //   for (let i = 0; i < Object.keys(user.emails).length; i++) {
    //     emailEntryDetails = await snowflakeInstance.entryDetails.call(1, 2, Object.keys(user.emails)[i])
    //     assert.equal(emailEntryDetails[0], hashedEmails[i])
    //     assert.deepEqual(emailEntryDetails[1], [])
    //   }

    //   var phoneEntryDetails
    //   for (let i = 0; i < Object.keys(user.phoneNumbers).length; i++) {
    //     phoneEntryDetails = await snowflakeInstance.entryDetails.call(1, 2, Object.keys(user.phoneNumbers)[i])
    //     assert.equal(phoneEntryDetails[0], hashedPhone[i])
    //     assert.deepEqual(phoneEntryDetails[1], [])
    //   }

    //   var addressEntryDetails
    //   for (let i = 0; i < Object.keys(user.physicalAddresses).length; i++) {
    //     addressEntryDetails = await snowflakeInstance.entryDetails.call(1, 2, Object.keys(user.physicalAddresses)[i])
    //     assert.equal(addressEntryDetails[0], hashedAddresses[i])
    //     assert.deepEqual(addressEntryDetails[1], [])
    //   }
    // })
  })

  describe('Test address resolver', function () {
    it('mint identity token', async function () {
      let tokenId = await snowflakeInstance.mintIdentityToken.call(
        hashedNames, hashedDateOfBirth, { from: user.public }
      )
      assert.equal(tokenId, '1')
      await snowflakeInstance.mintIdentityToken(hashedNames, hashedDateOfBirth, { from: user.public })
    })
  })
})
