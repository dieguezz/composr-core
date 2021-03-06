'use strict';

var BaseManager = require('../../../src/lib/managers/base.manager'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  sinon = require('sinon'),
  q = require('q'),
  expect = chai.expect,
  should = chai.should();

chai.use(chaiAsPromised);

var correctPhrases = require('../../fixtures/phrases').correct;
var utilsPromises = require('../../utils/promises');

var modelFixture = function(json){
  this.json = json;
  this.getId = () => json.id;
  this.getMD5 = () => json.md5;
  this.getRawModel = () => json;
};

var storeAPI = { 
  add: () => true,
  get: (domain, id) => null,
  getAsList : (domain) => null,
  reset: () => null,
  remove : () => null,
  exists : () => true
};

var daoAPI = {
  load : () => Promise.resolve(),
  loadAll : () => Promise.resolve(),
  save : () => Promise.resolve()
};

describe('Base manager', function() {
  var mockStore, mockDao, manager, stubEvents;
  var sandbox = sinon.sandbox.create();

  beforeEach(function(){
    mockStore = sinon.mock(storeAPI);
    mockDao = sinon.mock(daoAPI);

    manager = new BaseManager({
      itemName: 'phrases',
      store: storeAPI,
      dao : daoAPI,
      model: modelFixture,
      validator: function(item) {
        return Promise.resolve(item);
      }
    });

    stubEvents = sinon.stub();

    manager.events = {
      emit: stubEvents
    };
  });

  afterEach(function(){
    mockStore.restore();
    sandbox.restore();
  });

  it('exposes the needed prototype', function() {
    expect(BaseManager.prototype).to.respondTo('register');
    expect(BaseManager.prototype).to.respondTo('registerWithoutDomain');
    expect(BaseManager.prototype).to.respondTo('_register');
    expect(BaseManager.prototype).to.respondTo('unregister');
    expect(BaseManager.prototype).to.respondTo('_unregister');
    expect(BaseManager.prototype).to.respondTo('compile');
    expect(BaseManager.prototype).to.respondTo('_compile');
    expect(BaseManager.prototype).to.respondTo('__preAdd');
    expect(BaseManager.prototype).to.respondTo('_addToStore');
    expect(BaseManager.prototype).to.respondTo('__postAdd');
    expect(BaseManager.prototype).to.respondTo('validate');
    expect(BaseManager.prototype).to.respondTo('resetItems');
    expect(BaseManager.prototype).to.respondTo('_extractDomainFromId');
    expect(BaseManager.prototype).to.respondTo('_extractVirtualDomainFromId');
    expect(BaseManager.prototype).to.respondTo('getById');
    expect(BaseManager.prototype).to.respondTo('getByVirtualDomain');
    expect(BaseManager.prototype).to.respondTo('getByDomain');
    expect(BaseManager.prototype).to.respondTo('load');
    expect(BaseManager.prototype).to.respondTo('save');
  });


  describe('Item registration', function() {

    it('should allow to register an array of items', function(done) {
      mockStore.expects('add').twice();

      manager.register('domain', [{
        id: '1'
      }, {
        id: '2'
      }])
        .should.be.fulfilled
        .then(function(result) {
          expect(result).to.be.an('array');
          expect(result.length).to.equals(2);
          mockStore.verify();
        })
        .should.be.fulfilled.notify(done);
    });

    it('should allow to register a single item', function(done) {
      manager.register('domain', {
        id: '1'
      })
        .should.be.fulfilled
        .then(function(result) {
          expect(result).to.be.an('object');
        })
        .should.notify(done);
    });

    it('Should reject if the domain is missing', function(done) {
      manager.register(null, [{
        id: '1'
      }, {
        id: '2'
      }])
      .should.be.rejected.notify(done);
    });

    it('Should reject if the items are missing', function(done) {
      manager.register('test', null)
        .should.be.rejected.notify(done);
    });

    it('should emit a debug event when the item has been registered', function(done) {
      manager.register('domain', {
        id: '1'
      })
        .should.be.fulfilled
        .then(function() {
          expect(stubEvents.callCount).to.be.above(0);
          expect(stubEvents.calledWith('debug', 'phrases:registered')).to.equals(true);
        })
        .should.be.fulfilled.notify(done);
    });

    describe('Secure methods called', function() {
      var spyCompile, spyValidate, spyCompile, spyRegister, spyAddToList;

      beforeEach(function() {
        spyRegister = sandbox.spy(manager, '_register');
        spyCompile = sandbox.spy(manager, 'compile');
        spyValidate = sandbox.spy(manager, 'validate');
        spyCompile = sandbox.spy(manager, '_compile');
        spyAddToList = sandbox.spy(manager, '_addToStore');
      });

      afterEach(function() {
        spyRegister.restore();
        spyCompile.restore();
        spyValidate.restore();
        spyCompile.restore();
        spyAddToList.restore();
      });

      it('should call the compilation and validation methods when registering', function(done) {

        manager.register('test-domain', 'Something to register')
          .should.be.fulfilled
          .then(function() {
            expect(spyCompile.callCount).to.equals(1);
            expect(spyCompile.callCount).to.equals(1);
            expect(spyValidate.callCount).to.equals(1);
          })
          .should.be.fulfilled.notify(done);
      });

      it('should call the _register method with the domain', function(done) {

        manager.register('test-domain', 'Something to register')
          .should.be.fulfilled
          .then(function() {
            expect(spyRegister.callCount).to.equals(1);
            expect(spyRegister.calledWith('test-domain', 'Something to register')).to.equals(true);
          })
          .should.be.fulfilled.notify(done);
      });

      it('should call the _addToStore method with the domain', function(done) {

        manager.register('test-domain', 'Something to register')
          .should.be.fulfilled
          .then(function() {
            expect(spyAddToList.callCount).to.equals(1);
            expect(spyAddToList.calledWith('test-domain')).to.equals(true);
          })
          .should.be.fulfilled.notify(done);
      });

    });

    describe('when validation fails', function() {
      var stubEvents, aManager;

      beforeEach(function() {

        aManager = new BaseManager({
          model: modelFixture,
          store: storeAPI,
          itemName: 'testObject',
          validator: function(item) {
            if (item.id === 'invalid') {
              return Promise.reject();
            } else {
              return Promise.resolve(item);
            }
          }
        });

        stubEvents = sinon.stub();

        aManager.events = {
          emit: stubEvents
        };
      });

      describe('Validation fail', function() {

        it('should emit an error when the registering fails because the validation fails', function(done) {
          aManager.register('domain', {
            id: 'invalid'
          })
            .should.be.fulfilled
            .then(function() {
              expect(stubEvents.callCount).to.be.above(0);
              expect(stubEvents.calledWith('warn', 'testObject:not:registered')).to.equals(true);
              mockStore.expects('add').never();
              mockStore.verify();
            })
            .should.be.fulfilled.notify(done);
        });

        it('should return not registered when the registering fails because the validation fails', function(done) {
          aManager.register('domain', {
            id: 'invalid'
          })
            .should.be.fulfilled
            .then(function(result) {
              expect(result.registered).to.equals(false);
              mockStore.expects('add').never();
              mockStore.verify();
            })
            .should.be.fulfilled.notify(done);
        });

      });

      describe('Compilation fail', function() {
        var stubCompile;

        beforeEach(function() {
          stubCompile = sandbox.stub(aManager, 'compile', function() {
            return false;
          });
        });

        afterEach(function() {
          stubCompile.restore();
        });

        it('should emit an error when the registering fails because the compilation fails', function(done) {
          aManager.register('domain', {
            id: 'valid'
          })
            .then(function() {
              expect(stubEvents.callCount).to.be.above(0);
              expect(stubEvents.calledWith('warn', 'testObject:not:registered')).to.equals(true);
              mockStore.expects('add').never();
              mockStore.verify();
              done();
            });
        });

        it('should return the unregistered state when the compilation fails', function(done) {
          aManager.register('domain', {
            id: 'valid'
          })
            .should.be.fulfilled
            .then(function(result) {
              expect(result.registered).to.equals(false);
              mockStore.expects('add').never();
              mockStore.verify();
            })
            .should.notify(done);
        });
      });
    });
  });

  describe('Item reseting', function() {
    var manager;

    beforeEach(function() {
      manager = new BaseManager({
        itemName: 'myitem', 
        store : storeAPI,
        model : modelFixture
      });
    });

    it('Resets the item to an empty object', function() {
      mockStore.expects('reset').once();
      manager.resetItems();
      mockStore.verify();
    });
  });

  describe('Domain extraction', function() {

    var manager = new BaseManager({});

    var testItems = [{
      id: 'booqs:demo!loginuser',
      value: 'booqs:demo'
    }, {
      id: 'test-client!myphrase!:parameter',
      value: 'test-client'
    }, {
      id: 'booqs:demo!bookWarehouseDetailMock!:id',
      value: 'booqs:demo'
    }, {
      id: 'booqs:demo!UserModel',
      value: 'booqs:demo'
    }];

    it('Extracts all the domains correctly', function() {
      testItems.forEach(function(item) {
        expect(manager._extractDomainFromId(item.id)).to.equals(item.value);
      });
    });
  });

  describe('Items unregistration', function() {
    var spyUnregister, manager, stubEvents;

    beforeEach(function() {

      manager = new BaseManager({
        store: storeAPI,
        itemName: 'goodies'
      });

      spyUnregister = sandbox.spy(manager, '_unregister');

      stubEvents = sinon.stub();
      //Mock the composr external methods
      manager.events = {
        emit: stubEvents
      };
    });

    it('Should be able to receive a single item', function() {
      mockStore.expects('remove').once();
      manager.unregister('mydomain', 'testId');

      expect(spyUnregister.callCount).to.equals(1);
      mockStore.verify();
    });

    it('Should be emit info about the event when the item was registered', function() {
      mockStore.expects('remove').once();
      manager.unregister('mydomain', 'testId');

      expect(stubEvents.callCount).to.equals(2);
      expect(stubEvents.calledWith('debug', 'goodies:unregister:testId')).to.equals(true);
      mockStore.verify();
    });

    it('should warn about a missing element if the item was not registered', function(){
      mockStore.expects('remove').never();
      mockStore.expects('exists').once().returns(false);
      manager.unregister('mydomain', 'testId');

      expect(stubEvents.callCount).to.equals(2);
      expect(stubEvents.calledWith('warn', 'goodies:unregister:not:found')).to.equals(true);
      mockStore.verify();
    });

    it('Should be able to receive an array', function() {
      mockStore.expects('remove').exactly(5);
      manager.unregister('mydomain', ['testId', 'testId', 'testId', 'testId', 'testId']);

      expect(spyUnregister.callCount).to.equals(5);
      mockStore.verify();
    });
  });

  describe('Register without domain', function() {
    var stubRegister, manager;

    before(function() {
      manager = new BaseManager({
        item: '__mything',
        itemName: 'goodies'
      });

      stubRegister = sandbox.stub(manager, 'register', utilsPromises.resolvedPromise);
    });

    it('Calls the register method with the domain', function(done) {
      var examplePhrases = [{
        'id': 'domainTest!phrase'
      }, {
        'id': 'domainTest!phrase2'
      }, {
        'id': 'domainTest!phrase3'
      }, {
        'id': 'domainTwo!phrase'
      }];

      manager.registerWithoutDomain(examplePhrases)
        .then(function() {
          expect(stubRegister.callCount).to.equals(2);
          expect(stubRegister.calledWith('domainTest')).to.equals(true);
          expect(stubRegister.calledWith('domainTwo')).to.equals(true);
        })
        .should.notify(done);
    });
  });

  describe('Save', function(){

    describe('_should save check', function(){
      var stubGet;

      beforeEach(function(){
        stubGet = sandbox.stub(storeAPI, 'get', function(){
          var model = new modelFixture({ md5 : 'abc', id : 'domain!myid'});
          return model;
        })
      });

      it('returns false if the md5 is the same', function(){
        var result = manager.__shouldSave(new modelFixture({ md5 : 'abc', id : 'domain!myid'}));
        expect(result).to.equals(false);
        expect(stubGet.calledWith('domain', 'domain!myid')).to.equals(true);
      });

      it('returns true if the md5 differs', function(){
        var result = manager.__shouldSave(new modelFixture({ md5 : 'dfg', id : 'domain!myid'}));
        expect(result).to.equals(true);
        expect(stubGet.calledWith('domain', 'domain!myid')).to.equals(true);
      });

    });
  });

  describe('Get by id', function(){
    it('Calls store get with correct parameters', function(){
      var id = 'my:domain!item!url';
      var spyExtractDomainFromId = sandbox.spy(manager, '_extractDomainFromId');
      mockStore.expects('get').once().withArgs('my:domain', id);
      
      manager.getById(id);
      expect(spyExtractDomainFromId.callCount).to.equals(1);
      mockStore.verify();
    });

    //TODO : add more test cases with invalid domains ids
  });  

  describe('Get by domain', function(){
    it('Calls store get with correct parameters', function(){
      var domain = 'my:domain';
      
      mockStore.expects('getAsList').once().withArgs('my:domain');
      
      manager.getByDomain(domain);
      mockStore.verify();
    });
  });

  describe('_extractDomainFromId', function(){
    it('Succesfully returns the domain from the id', function(){
      var ids = [{
        value : 'test:demo:1!hi',
        id : 'test:demo:1'
      },{
        value : 'test!hi',
        id : 'test'
      },{
        value : 'test:demo!hi!sandbox!url:whatever!another',
        id : 'test:demo'
      },{
        value : 'hi:hi',
        id : 'hi:hi'
      }];

      ids.forEach(function(item){
        var result = manager._extractDomainFromId(item.id);
        expect(result).to.equals(item.id);
      });
    });
  });

  describe('Load', function(){
    var mockitem = {
      name : 'me'
    };

    it('Calls the dao with an id', function(done){
      mockDao.expects('load').once().withArgs('my:domain!id')
        .returns(Promise.resolve(mockitem));
      
      manager.load('my:domain!id')
        .then(function(res){
          mockDao.verify();
          mockDao.restore();
          done();
        });
    });

    it('Registers the item', function(done){
      var spyRegister = sandbox.spy(manager, 'register');

      mockDao.expects('load').once().withArgs('my:domain!id')
        .returns(Promise.resolve(mockitem));
      
      manager.load('my:domain!id')
        .then(function(){
          mockDao.verify();
          expect(spyRegister.callCount).to.equals(1);
          expect(spyRegister.calledWith('my:domain')).to.equals(true);
          done();
        });
    });

    it('calls load all without id', function(){
      var spyRegister = sandbox.spy(manager, 'register');

      mockDao.expects('loadAll').once()
        .returns(Promise.resolve([mockitem]));
      
      manager.load()
        .then(function(){
          mockDao.verify();
          expect(spyRegister.callCount).to.equals(1);
          expect(spyRegister.calledWith('my:domain')).to.equals(true);
          done();
        });
    });
  });

});
